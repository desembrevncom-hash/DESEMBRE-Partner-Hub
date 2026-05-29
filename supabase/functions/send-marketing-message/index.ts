import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Feature Flag ──────────────────────────────────────────────────────────────
const PROVIDER_SEND_ENABLED = Deno.env.get("MARKETING_PROVIDER_SEND_ENABLED") === "true";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RequestBody {
  customerId: string;
  templateId?: string;
  campaignId?: string;
  channel: string;         // 'email' | 'zalo' | 'zalo_oa' | 'phone'
  mode: string;            // 'copy' | 'provider_send'
  messageMode: string;     // 'campaign' | 'sale_followup'
  ownerUserId?: string;
  overrideVariables?: Record<string, string>;
  isTest?: boolean;
  testRecipientEmail?: string;
  testSenderId?: string;
  testSenderType?: "business" | "personal";
}

// Helper to interpolate message template variables
function renderTemplate(templateStr: string, varsObj: Record<string, any>): string {
  if (!templateStr) return "";
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = varsObj[key];
    return val === null || val === undefined ? `{{${key}}}` : String(val);
  });
}

serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl   = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon  = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAdmin = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify JWT with user client
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Role check ─────────────────────────────────────────────────────────────
  const adminClient = createClient(supabaseUrl, supabaseAdmin);
  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleRow?.role ?? "sale";
  const isAdmin = role === "admin" || role === "sub_admin";
  const isSale  = role === "sale" || role === "tele_sale";
  const canCall = isAdmin || isSale;

  if (!canCall) {
    return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { 
    customerId, 
    templateId, 
    campaignId, 
    channel, 
    mode, 
    messageMode, 
    ownerUserId,
    isTest,
    testRecipientEmail,
    testSenderId,
    testSenderType,
    overrideVariables
  } = body;

  if (!customerId || !channel || !mode || !messageMode) {
    return new Response(JSON.stringify({ error: "Missing required fields: customerId, channel, mode, messageMode" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const logCustomerId = isTest ? null : customerId;

  // ── Load customer ─────────────────────────────────────────────────────────
  let customer: any = null;
  if (isTest) {
    customer = {
      id: null,
      email: testRecipientEmail || "test@example.com",
      phone: null,
      marketing_opt_in: true,
      marketing_opt_out_at: null,
      name: "Người Nhận Thử Nghiệm"
    };
  } else {
    const { data: dbCustomer, error: custErr } = await adminClient
      .from("customers")
      .select("id, marketing_opt_out_at, marketing_opt_in, email, phone, name")
      .eq("id", customerId)
      .single();

    if (custErr || !dbCustomer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    customer = dbCustomer;
  }

  // ── Opt-out check ─────────────────────────────────────────────────────────
  if (!isTest && customer.marketing_opt_out_at) {
    // Log blocked
    await adminClient.rpc("log_marketing_delivery_event", {
      p_customer_id: logCustomerId,
      p_campaign_id: campaignId ?? null,
      p_template_id: templateId ?? null,
      p_channel: channel,
      p_mode: mode,
      p_status: "blocked",
      p_reason: "opt_out",
    });

    return new Response(JSON.stringify({
      allowed: false,
      reason: "Khách hàng đã Opt-out. Không thể gửi.",
      status: "blocked",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Resolve sender ────────────────────────────────────────────────────────
  let resolvedSenderId: string | null = null;
  let senderType: "business" | "personal" | "none" = "none";
  const warnings: string[] = [];

  if (isTest && testSenderId && testSenderType) {
    resolvedSenderId = testSenderId;
    senderType = testSenderType;
  } else if (messageMode === "campaign") {
    // Load active business senders
    const { data: bizSenders } = await adminClient
      .from("sender_accounts")
      .select("id, name, channel, is_active, health_status, daily_usage, daily_limit")
      .eq("is_active", true);

    const candidates = (bizSenders ?? []).filter((s: any) =>
      s.channel?.toLowerCase().includes(channel.replace("zalo", "zalo_oa"))
    );

    const goodSender = candidates.find((s: any) =>
      s.health_status !== "error" &&
      (s.daily_limit === 0 || (s.daily_usage ?? 0) < (s.daily_limit ?? 9999))
    ) as any;

    if (!goodSender) {
      await adminClient.rpc("log_marketing_delivery_event", {
        p_customer_id: customerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
        p_channel: channel, p_mode: mode, p_status: "blocked",
        p_reason: "no_healthy_business_sender",
      });
      return new Response(JSON.stringify({
        allowed: false,
        reason: `Không có Business Sender hợp lệ cho kênh ${channel}.`,
        status: "blocked",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    resolvedSenderId = goodSender.id;
    senderType = "business";

    if (goodSender.health_status === "warning") {
      warnings.push(`Sender "${goodSender.name}" đang ở trạng thái cảnh báo.`);
    }
    const pct = goodSender.daily_limit > 0
      ? Math.round((goodSender.daily_usage / goodSender.daily_limit) * 100) : 0;
    if (pct > 80) warnings.push(`Quota sender "${goodSender.name}": ${pct}% đã dùng.`);

  } else if (messageMode === "sale_followup") {
    const targetUser = ownerUserId ?? user.id;
    const platform = channel === "email" ? "email" : channel.includes("zalo") ? "zalo" : "phone";

    const { data: personalSenders } = await adminClient
      .from("user_communication_accounts")
      .select("id, user_id, platform, account_name, is_active, health_status")
      .eq("user_id", targetUser)
      .eq("is_active", true);

    const personal = (personalSenders ?? []).find((a: any) =>
      a.platform?.toLowerCase().includes(platform)
    ) as any;

    if (!personal) {
      await adminClient.rpc("log_marketing_delivery_event", {
        p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
        p_channel: channel, p_mode: mode, p_status: "blocked",
        p_reason: "no_personal_sender",
      });
      return new Response(JSON.stringify({
        allowed: false,
        reason: `Sale chưa cấu hình tài khoản cá nhân kênh ${channel}.`,
        status: "blocked",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (personal.health_status === "error") {
      await adminClient.rpc("log_marketing_delivery_event", {
        p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
        p_personal_sender_id: personal.id, p_channel: channel, p_mode: mode,
        p_status: "blocked", p_reason: "personal_sender_error",
      });
      return new Response(JSON.stringify({
        allowed: false,
        reason: `Tài khoản cá nhân "${personal.account_name}" đang lỗi. Cần kết nối lại.`,
        status: "blocked",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    resolvedSenderId = personal.id;
    senderType = "personal";
    if (personal.health_status === "warning") {
      warnings.push(`Tài khoản "${personal.account_name}" đang cảnh báo.`);
    }
  }

  // ── Mode: copy → return resolved info + log ───────────────────────────────
  if (mode === "copy") {
    await adminClient.rpc("log_marketing_delivery_event", {
      p_customer_id: logCustomerId,
      p_campaign_id: campaignId ?? null,
      p_template_id: templateId ?? null,
      p_sender_account_id: senderType === "business" ? resolvedSenderId : null,
      p_personal_sender_id: senderType === "personal" ? resolvedSenderId : null,
      p_channel: channel,
      p_mode: "copy",
      p_status: "copied",
      p_reason: null,
    });

    return new Response(JSON.stringify({
      allowed: true,
      senderType,
      senderId: resolvedSenderId,
      channel,
      mode: "copy",
      status: "copied",
      warnings,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Mode: provider_send ───────────────────────────────────────────────────
  if (mode === "provider_send") {
    if (!isTest && !PROVIDER_SEND_ENABLED) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: "Provider send is disabled (MARKETING_PROVIDER_SEND_ENABLED=false). Only copy mode is available.",
        status: "blocked",
        warnings,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load template body for sending
    let templateBody = "";
    let templateSubject = "";
    let sampleVars: Record<string, any> = {};
    if (templateId) {
      const { data: tpl } = await adminClient
        .from("message_templates")
        .select("body_template, subject_template, channel, sample_variables")
        .eq("id", templateId)
        .single();
      templateBody    = tpl?.body_template ?? "";
      templateSubject = tpl?.subject_template ?? "";
      sampleVars      = tpl?.sample_variables ?? {};
    }

    // Interpolate variables
    const finalVars = {
      customer_name: customer?.name || "Khách Hàng",
      customer_email: customer?.email || "",
      ...sampleVars,
      ...(overrideVariables || {})
    };

    const renderedSubject = renderTemplate(templateSubject || "Thông tin từ DESEMBRE", finalVars);
    const renderedBody = renderTemplate(templateBody || "<p>Nội dung email từ DESEMBRE.</p>", finalVars);

    // ── Email via Provider (Resend or SMTP) ──────────────────────────────────
    if (channel === "email") {
      let customerEmail = customer.email;
      if (!customerEmail) {
        await adminClient.rpc("log_marketing_delivery_event", {
          p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
          p_sender_account_id: senderType === "business" ? resolvedSenderId : null,
          p_personal_sender_id: senderType === "personal" ? resolvedSenderId : null,
          p_channel: channel, p_mode: "provider_send",
          p_status: "failed", p_reason: "missing_customer_email",
        });
        return new Response(JSON.stringify({ allowed: false, status: "failed", reason: "Khách hàng không có email." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (senderType === "business") {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) {
          // Log and return error
          await adminClient.rpc("log_marketing_delivery_event", {
            p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
            p_sender_account_id: resolvedSenderId, p_channel: channel, p_mode: "provider_send",
            p_status: "failed", p_reason: "missing_resend_key",
          });
          return new Response(JSON.stringify({ allowed: false, status: "failed", reason: "RESEND_API_KEY not configured." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: senderRow } = await adminClient
          .from("sender_accounts")
          .select("sender_email, name")
          .eq("id", resolvedSenderId)
          .single() as any;

        const senderEmail = senderRow?.sender_email ?? "noreply@desembrevn.com";
        const senderName  = senderRow?.name ?? "DESEMBRE";

        try {
          const resendResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${senderName} <${senderEmail}>`,
              to: [customerEmail],
              subject: renderedSubject,
              html: renderedBody,
            }),
          });

          const resendData = await resendResp.json() as any;

          if (!resendResp.ok) {
            await adminClient.rpc("log_marketing_delivery_event", {
              p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
              p_sender_account_id: resolvedSenderId, p_channel: channel, p_mode: "provider_send",
              p_status: "failed", p_reason: resendData?.message ?? "Resend API error",
            });
            await adminClient.from("sender_accounts").update({
              health_status: "error", last_error: resendData?.message ?? "Unknown Resend error",
              last_checked_at: new Date().toISOString(),
            }).eq("id", resolvedSenderId);

            return new Response(JSON.stringify({ allowed: false, status: "failed", reason: resendData?.message }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const providerMsgId = resendData?.id ?? null;
          await adminClient.rpc("log_marketing_delivery_event", {
            p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
            p_sender_account_id: resolvedSenderId, p_channel: channel, p_mode: "provider_send",
            p_status: "sent", p_reason: null, p_provider_message_id: providerMsgId,
          });
          await adminClient.rpc("increment_sender_daily_usage", { p_sender_id: resolvedSenderId });

          return new Response(JSON.stringify({
            allowed: true, status: "sent", senderType, senderId: resolvedSenderId,
            providerMessageId: providerMsgId, warnings,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (e: any) {
          await adminClient.rpc("log_marketing_delivery_event", {
            p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
            p_sender_account_id: resolvedSenderId, p_channel: channel, p_mode: "provider_send",
            p_status: "failed", p_reason: e.message,
          });
          return new Response(JSON.stringify({ allowed: false, status: "failed", reason: e.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (senderType === "personal") {
        // Gửi qua SMTP bằng Gmail cá nhân
        // Import require dynamically inside or use fetch if denomailer
        // Deno Deploy allows dynamic import of npm packages
        const { data: personalSender } = await adminClient
          .from("user_communication_accounts")
          .select("account_identifier, provider_secret, account_name")
          .eq("id", resolvedSenderId)
          .single() as any;

        if (!personalSender?.provider_secret) {
          await adminClient.rpc("log_marketing_delivery_event", {
            p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
            p_personal_sender_id: resolvedSenderId, p_channel: channel, p_mode: "provider_send",
            p_status: "failed", p_reason: "Chưa cấu hình Mật khẩu ứng dụng (App Password)",
          });
          return new Response(JSON.stringify({ allowed: false, status: "failed", reason: "Chưa cấu hình App Password cho Gmail cá nhân." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          const nodemailer = await import("npm:nodemailer");
          const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
              user: personalSender.account_identifier,
              pass: personalSender.provider_secret,
            },
          });

          const info = await transporter.sendMail({
            from: `"${personalSender.account_name}" <${personalSender.account_identifier}>`,
            to: customerEmail,
            subject: renderedSubject,
            html: renderedBody,
          });

          await adminClient.rpc("log_marketing_delivery_event", {
            p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
            p_personal_sender_id: resolvedSenderId, p_channel: channel, p_mode: "provider_send",
            p_status: "sent", p_reason: null, p_provider_message_id: info.messageId,
          });

          return new Response(JSON.stringify({
            allowed: true, status: "sent", senderType, senderId: resolvedSenderId,
            providerMessageId: info.messageId, warnings,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (e: any) {
          await adminClient.rpc("log_marketing_delivery_event", {
            p_customer_id: logCustomerId, p_campaign_id: campaignId ?? null, p_template_id: templateId ?? null,
            p_personal_sender_id: resolvedSenderId, p_channel: channel, p_mode: "provider_send",
            p_status: "failed", p_reason: e.message,
          });
          
          await adminClient.from("user_communication_accounts").update({
            health_status: "error", last_error: e.message
          }).eq("id", resolvedSenderId);

          return new Response(JSON.stringify({ allowed: false, status: "failed", reason: e.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // ── Zalo / other channels → stub (disabled unless integrated) ─────────
    return new Response(JSON.stringify({
      allowed: false,
      status: "blocked",
      reason: `Provider send cho kênh ${channel} chưa được tích hợp. Chỉ dùng copy mode.`,
      warnings,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Unknown mode" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
