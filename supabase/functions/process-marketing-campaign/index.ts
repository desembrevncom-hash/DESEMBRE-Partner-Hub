import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Giới hạn an toàn cho Personal Sender (Gmail cá nhân) ────────────────────
const PERSONAL_SENDER_MAX_PER_CAMPAIGN = 50;

// ─── Kiểm tra tuân thủ gửi ────────────────────────────────────────────────────
interface ComplianceCheckRes {
  allowed: boolean;
  status: string;
  error_message?: string;
}

function checkCompliance(customer: any, template: any, lastLogs: any[]): ComplianceCheckRes {
  if (!customer.email && !customer.phone) {
    return { allowed: false, status: 'failed', error_message: 'Thiếu thông tin liên lạc' };
  }
  if (customer.marketing_opt_out_at) {
    return { allowed: false, status: 'opt_out_skipped', error_message: 'Khách hàng đã từ chối nhận tin' };
  }
  if (template.requires_opt_in && !customer.marketing_opt_in) {
    return { allowed: false, status: 'opt_out_skipped', error_message: 'Khuôn mẫu yêu cầu Opt-in' };
  }
  if (template.max_send_frequency_days && template.max_send_frequency_days > 0) {
    const limitMs = template.max_send_frequency_days * 24 * 3600 * 1000;
    const nowMs = Date.now();
    for (const l of lastLogs) {
      if (l.customer_id === customer.id && ['sent', 'delivered'].includes(l.status)) {
        if (l.purpose === template.purpose || l.channel === template.channel) {
          const sentTime = new Date(l.created_at).getTime();
          if (nowMs - sentTime < limitMs) {
            return { allowed: false, status: 'frequency_capped', error_message: 'Vi phạm giới hạn tần suất ngày' };
          }
        }
      }
    }
  }
  return { allowed: true, status: 'delivered' };
}

// ─── Hàm gửi email qua Resend (Business Sender) ───────────────────────────────
async function sendViaResend(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [toEmail],
        subject,
        html,
      }),
    });
    const data = await resp.json() as any;
    if (!resp.ok) return { success: false, error: data?.message ?? "Resend API error" };
    return { success: true, messageId: data?.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Hàm gửi email qua SMTP (Personal Sender / Gmail App Password) ────────────
async function sendViaSmtp(
  gmailUser: string,
  appPassword: string,
  displayName: string,
  toEmail: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const nodemailer = await import("npm:nodemailer");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: appPassword },
    });
    const info = await transporter.sendMail({
      from: `"${displayName}" <${gmailUser}>`,
      to: toEmail,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("Tham số campaign_id là bắt buộc");

    // 1. Nạp thông tin chiến dịch
    const { data: camp, error: errCamp } = await supabase
      .from("marketing_campaigns")
      .select("*, message_templates(*), sender_accounts(*)")
      .eq("id", campaign_id)
      .single();

    if (errCamp || !camp) throw new Error("Không tìm thấy chiến dịch: " + (errCamp?.message || ""));

    if (camp.status === 'scheduled') {
      await supabase.from("marketing_campaigns")
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq("id", campaign_id);
    }

    const tpl = camp.message_templates || { channel: 'email', purpose: 'marketing_campaign', requires_opt_in: true };
    const bizSender = camp.sender_accounts || null;

    // 2. Nạp danh sách khách hàng mục tiêu
    let customers: any[] = [];
    if (camp.segment_id) {
      const { data: mapData } = await supabase
        .from("customer_segments_map").select("customer_id").eq("segment_id", camp.segment_id);
      if (mapData && mapData.length > 0) {
        const cIds = mapData.map((m: any) => m.customer_id);
        const { data: cData } = await supabase.from("customers").select("*").in("id", cIds);
        if (cData) customers = cData;
      } else {
        const { data: cData } = await supabase.from("customers").select("*").limit(200);
        if (cData) customers = cData;
      }
    } else {
      const { data: cData } = await supabase.from("customers").select("*").limit(500);
      if (cData) customers = cData;
    }

    if (customers.length === 0) {
      await supabase.from("marketing_campaigns").update({
        status: 'completed', metrics: { total_targets: 0, sent: 0, failed: 0, capped: 0 },
        updated_at: new Date().toISOString()
      }).eq("id", campaign_id);
      return new Response(JSON.stringify({ success: true, targets: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Nạp log gửi gần đây để kiểm tra chu kỳ
    const cIds = customers.map(c => c.id);
    const { data: recentLogs } = await supabase
      .from("message_send_logs")
      .select("customer_id, channel, purpose, status, created_at")
      .in("customer_id", cIds)
      .order("created_at", { ascending: false });

    const logsArr = recentLogs || [];

    // 4. Load Sale (owner) thông tin với Gmail/App Password (Smart Routing)
    // Gom nhóm owner_user_id từ customers
    const ownerIds = [...new Set(customers.map((c: any) => c.user_id).filter(Boolean))];
    const personalSenderMap: Record<string, any> = {};
    if (ownerIds.length > 0 && tpl.channel === 'email') {
      const { data: personalAccounts } = await supabase
        .from("user_communication_accounts")
        .select("id, user_id, platform, account_identifier, account_name, provider_secret, is_active")
        .in("user_id", ownerIds)
        .eq("platform", "email")
        .eq("is_active", true);

      for (const acc of (personalAccounts || [])) {
        // Chỉ chọn tài khoản có App Password
        if (acc.provider_secret && !personalSenderMap[acc.user_id]) {
          personalSenderMap[acc.user_id] = acc;
        }
      }
    }

    // 5. Gửi mail & đếm kết quả
    let sentCount = 0;
    let failedCount = 0;
    let cappedCount = 0;
    let personalSentInThisCampaign = 0;

    const logInserts: any[] = [];

    const templateSubject = tpl.subject_template || "Thông tin từ DESEMBRE";
    const templateHtml = tpl.body_template || "<p>Nội dung email từ DESEMBRE.</p>";
    const isEmailCampaign = (tpl.channel || 'email') === 'email';

    for (const c of customers) {
      const check = checkCompliance(c, tpl, logsArr);
      if (!check.allowed) {
        logInserts.push({
          campaign_id, template_id: tpl.id || null,
          sender_account_id: bizSender?.id || null,
          customer_id: c.id, channel: tpl.channel || 'email',
          purpose: tpl.purpose || 'marketing_campaign',
          recipient_email: c.email || null, recipient_phone: c.phone || null,
          status: check.status, error_message: check.error_message || null,
          provider_response: { check_timestamp: new Date().toISOString() }
        });
        if (check.status === 'frequency_capped') cappedCount++;
        else failedCount++;
        continue;
      }

      // ── Chỉ gửi thực sự nếu là kênh Email ────────────────────────────────
      if (!isEmailCampaign || !c.email) {
        // Kênh khác hoặc không có email → log delivered (placeholder)
        logInserts.push({
          campaign_id, template_id: tpl.id || null,
          sender_account_id: bizSender?.id || null,
          customer_id: c.id, channel: tpl.channel || 'email',
          purpose: tpl.purpose || 'marketing_campaign',
          recipient_email: c.email || null, recipient_phone: c.phone || null,
          status: c.email ? 'delivered' : 'failed',
          error_message: !c.email ? 'Khách hàng không có email' : null,
          provider_response: { note: 'non-email channel or missing email' }
        });
        if (c.email) sentCount++; else failedCount++;
        continue;
      }

      // ── Smart Routing: ưu tiên Personal Sender của Sale phụ trách ─────────
      let sendResult: { success: boolean; messageId?: string; error?: string } | null = null;
      let usedSenderType: 'personal' | 'business' | 'none' = 'none';
      let usedPersonalSenderId: string | null = null;
      let usedBizSenderId: string | null = null;

      const ownerPersonal = c.user_id ? personalSenderMap[c.user_id] : null;

      if (ownerPersonal && personalSentInThisCampaign < PERSONAL_SENDER_MAX_PER_CAMPAIGN) {
        // Gửi qua Gmail cá nhân của Sale
        sendResult = await sendViaSmtp(
          ownerPersonal.account_identifier,
          ownerPersonal.provider_secret,
          ownerPersonal.account_name,
          c.email,
          templateSubject,
          templateHtml,
        );
        usedSenderType = 'personal';
        usedPersonalSenderId = ownerPersonal.id;

        if (sendResult.success) {
          personalSentInThisCampaign++;
        } else {
          // Nếu SMTP lỗi → fallback sang Business Sender
          console.warn(`SMTP failed for owner ${c.user_id}: ${sendResult.error}. Falling back to Business Sender.`);
          // Update health for that personal account
          await supabase.from("user_communication_accounts").update({
            health_status: "error",
            last_error: sendResult.error || "SMTP error"
          }).eq("id", ownerPersonal.id);
        }
      }

      // Fallback hoặc không có Personal Sender → dùng Business Sender (Resend)
      if (!sendResult || !sendResult.success) {
        const activeApiKey = bizSender?.provider_secret || RESEND_API_KEY;
        if (bizSender?.id && activeApiKey) {
          const { data: senderRow } = await supabase
            .from("sender_accounts")
            .select("sender_email, name, provider_secret")
            .eq("id", bizSender.id)
            .single() as any;

          const finalApiKey = senderRow?.provider_secret || activeApiKey;

          sendResult = await sendViaResend(
            finalApiKey,
            senderRow?.sender_email ?? "noreply@desembrevn.com",
            senderRow?.name ?? "DESEMBRE",
            c.email,
            templateSubject,
            templateHtml,
          );
          usedSenderType = 'business';
          usedBizSenderId = bizSender.id;
          usedPersonalSenderId = null; // reset vì đã fallback
        } else if (!sendResult) {
          // Không có Business Sender cũng không có Personal → skip
          sendResult = { success: false, error: "Không có sender khả dụng (Không có Business Sender và Personal Sender chưa cấu hình App Password)" };
          usedSenderType = 'none';
        }
      }

      // ── Ghi log & đếm kết quả ─────────────────────────────────────────────
      const finalStatus = sendResult.success ? 'sent' : 'failed';
      logInserts.push({
        campaign_id, template_id: tpl.id || null,
        sender_account_id: usedBizSenderId,
        customer_id: c.id, channel: 'email',
        purpose: tpl.purpose || 'marketing_campaign',
        recipient_email: c.email, recipient_phone: c.phone || null,
        status: finalStatus,
        error_message: sendResult.success ? null : sendResult.error,
        provider_response: {
          sender_type: usedSenderType,
          personal_sender_id: usedPersonalSenderId,
          message_id: sendResult.messageId,
          timestamp: new Date().toISOString(),
        }
      });

      if (sendResult.success) {
        sentCount++;
        if (usedSenderType === 'business' && bizSender?.id) {
          // Tăng daily_usage cho Business Sender
          await supabase.rpc("increment_sender_daily_usage", { p_sender_id: bizSender.id });
        }
      } else {
        failedCount++;
      }

      // Delay nhỏ để tránh rate-limit SMTP (50ms/email cho Personal)
      if (usedSenderType === 'personal') {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    // 6. Ghi log hàng loạt theo lô nhỏ
    for (let i = 0; i < logInserts.length; i += 50) {
      const chunk = logInserts.slice(i, i + 50);
      await supabase.from("message_send_logs").insert(chunk);
    }

    // 7. Cập nhật kết quả chiến dịch
    await supabase.from("marketing_campaigns").update({
      status: 'completed',
      metrics: {
        total_targets: customers.length,
        sent: sentCount,
        failed: failedCount,
        capped: cappedCount,
        personal_sent: personalSentInThisCampaign,
      },
      updated_at: new Date().toISOString()
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({
      success: true,
      processed: customers.length,
      sent: sentCount,
      failed: failedCount,
      capped: cappedCount,
      personal_sent: personalSentInThisCampaign,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
