import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cấu trúc kiểm tra tuân thủ tối thiểu
interface ComplianceCheckRes {
  allowed: boolean;
  status: string;
  error_message?: string;
}

function checkCompliance(customer: any, template: any, lastLogs: any[]): ComplianceCheckRes {
  // 1. Kiểm tra thiếu liên lạc
  if (!customer.email && !customer.phone) {
    return { allowed: false, status: 'failed', error_message: 'Thiếu thông tin liên lạc' };
  }

  // 2. Kiểm tra Opt-out
  if (customer.marketing_opt_out_at) {
    return { allowed: false, status: 'opt_out_skipped', error_message: 'Khách hàng đã từ chối nhận tin' };
  }

  // 3. Kiểm tra Opt-in
  if (template.requires_opt_in && !customer.marketing_opt_in) {
    return { allowed: false, status: 'opt_out_skipped', error_message: 'Khuôn mẫu yêu cầu Opt-in' };
  }

  // 4. Kiểm tra giới hạn chu kỳ
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) {
      throw new Error("Tham số campaign_id là bắt buộc");
    }

    // 1. Nạp thông tin chiến dịch
    const { data: camp, error: errCamp } = await supabase
      .from("marketing_campaigns")
      .select("*, message_templates(*), sender_accounts(*)")
      .eq("id", campaign_id)
      .single();

    if (errCamp || !camp) {
      throw new Error("Không tìm thấy chiến dịch định danh: " + (errCamp?.message || ""));
    }

    // Chuyển sang processing nếu đang ở scheduled
    if (camp.status === 'scheduled') {
      await supabase.from("marketing_campaigns").update({ status: 'processing', updated_at: new Date().toISOString() }).eq("id", campaign_id);
    }

    const tpl = camp.message_templates || { channel: 'email', purpose: 'marketing_campaign', requires_opt_in: true };
    const sender = camp.sender_accounts || { id: null };

    // 2. Nạp danh sách đích từ customer_segments_map hoặc nạp toàn bộ
    let customers: any[] = [];
    if (camp.segment_id) {
      // Tìm map
      const { data: mapData } = await supabase.from("customer_segments_map").select("customer_id").eq("segment_id", camp.segment_id);
      if (mapData && mapData.length > 0) {
        const cIds = mapData.map((m: any) => m.customer_id);
        const { data: cData } = await supabase.from("customers").select("*").in("id", cIds);
        if (cData) customers = cData;
      } else {
        // Fallback nạp tĩnh cho dynamic segment
        const { data: cData } = await supabase.from("customers").select("*").limit(200);
        if (cData) customers = cData;
      }
    } else {
      const { data: cData } = await supabase.from("customers").select("*").limit(500);
      if (cData) customers = cData;
    }

    if (customers.length === 0) {
      // Hoàn tất với 0 đích
      await supabase.from("marketing_campaigns").update({
        status: 'completed',
        metrics: { total_targets: 0, sent: 0, failed: 0, capped: 0 },
        updated_at: new Date().toISOString()
      }).eq("id", campaign_id);
      return new Response(JSON.stringify({ success: true, targets: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Nạp log gửi gần đây của tập đích để tính toán chu kỳ
    const cIds = customers.map(c => c.id);
    const { data: recentLogs } = await supabase
      .from("message_send_logs")
      .select("customer_id, channel, purpose, status, created_at")
      .in("customer_id", cIds)
      .order("created_at", { ascending: false });

    const logsArr = recentLogs || [];

    // 4. Phát hành và Ghi log
    let sentCount = 0;
    let failedCount = 0;
    let cappedCount = 0;

    const logInserts: any[] = [];

    for (const c of customers) {
      const check = checkCompliance(c, tpl, logsArr);

      logInserts.push({
        campaign_id: campaign_id,
        template_id: tpl.id || null,
        sender_account_id: sender.id || null,
        customer_id: c.id,
        channel: tpl.channel || 'email',
        purpose: tpl.purpose || 'marketing_campaign',
        recipient_email: c.email || `${c.id}@spa.local`,
        recipient_phone: c.phone || null,
        status: check.status,
        error_message: check.error_message || null,
        provider_response: { check_timestamp: new Date().toISOString() }
      });

      if (check.status === 'delivered' || check.status === 'sent') {
        sentCount++;
      } else if (check.status === 'frequency_capped') {
        cappedCount++;
      } else {
        failedCount++;
      }
    }

    // Ghi hàng loạt vào bảng message_send_logs
    if (logInserts.length > 0) {
      // Ghi theo lô nhỏ để tránh nghẽn
      for (let i = 0; i < logInserts.length; i += 50) {
        const chunk = logInserts.slice(i, i + 50);
        await supabase.from("message_send_logs").insert(chunk);
      }
    }

    // 5. Cập nhật số liệu tổng kết
    await supabase.from("marketing_campaigns").update({
      status: 'completed',
      metrics: {
        total_targets: customers.length,
        sent: sentCount,
        failed: failedCount,
        capped: cappedCount
      },
      updated_at: new Date().toISOString()
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({
      success: true,
      processed: customers.length,
      sent: sentCount,
      capped: cappedCount
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
