import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { resolveResendCredential } from "../_shared/sender-credentials.ts";
import { buildSuppressionSet, buildEligibleAudience } from "../_shared/audience-filter.ts";
import { generateUnsubscribeToken } from "../_shared/marketing-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helper to render template variables
function renderTemplate(templateStr: string, varsObj: Record<string, any>): string {
  if (!templateStr) return "";
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = varsObj[key];
    return val === null || val === undefined ? `{{${key}}}` : String(val);
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseAdminKey);

    // 1. Auth & Role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization", step: "auth" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await adminClient.auth.getUser(token);

    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized", step: "auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    const role = roleData?.role;

    if (role !== "admin" && role !== "sub_admin") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Admin/SubAdmin only",
          step: "role_check",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Body
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_json_body", step: "validation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaign_id, confirm, dry_run } = body;
    const providerMode = body.provider_mode || body.providerMode;

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing campaign_id", step: "validation" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Campaign Check
    const { data: campaign, error: campErr } = await adminClient
      .from("marketing_campaigns")
      .select(
        "id, channel, approval_status, segment_id, draft_subject, draft_body, sender_account_id, audience_count",
      )
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign not found", step: "campaign_check" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (campaign.approval_status !== "approved") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campaign phải được duyệt (approved) mới có thể gửi production.",
          step: "approval_check",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Global Kill Switch & Mode Validation
    if (!providerMode) {
      return new Response(
        JSON.stringify({ success: false, error: "missing_provider_mode", step: "provider_mode_check" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (providerMode !== "mock" && providerMode !== "resend_pilot" && providerMode !== "resend_limited_pilot") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only mock, resend_pilot, or resend_limited_pilot mode is allowed.",
          step: "provider_mode_check",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (providerMode === "resend_limited_pilot") {
      if (confirm !== "CONFIRM_LIMITED_PILOT") {
        return new Response(
          JSON.stringify({ success: false, error: "missing_limited_pilot_confirm", step: "confirm_check" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const productionSendingEnabled = Deno.env.get("MARKETING_PRODUCTION_SENDING_ENABLED") === "true";
    if (dry_run !== true) {
      if (!productionSendingEnabled) {
        return new Response(
          JSON.stringify({
            success: false,
            error: providerMode === "resend_limited_pilot" ? "production_sending_disabled" : "Production sending is disabled",
            step: "global_kill_switch",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    const effectiveChannel = campaign.channel ?? "email";

    // 5. Load Suppression List
    const { data: suppressions } = await adminClient
      .from("marketing_suppression_list")
      .select("channel, normalized_contact_value, is_active")
      .eq("is_active", true);

    const suppressionSet = buildSuppressionSet(suppressions);

    // 6. Query Customers (Max 10000)
    let customers: any[] = [];
    let static_audience_count = 0;
    
    if (campaign.segment_id) {
      const { data: mapData } = await adminClient
        .from("customer_segments_map")
        .select("customer_id")
        .eq("segment_id", campaign.segment_id);
      if (mapData && mapData.length > 0) {
        static_audience_count = mapData.length;
        const cIds = mapData.map((m: any) => m.customer_id);
        const { data: cData, error: cErr } = await adminClient
          .from("customers")
          .select("id, name, email, phone, marketing_opt_in, marketing_opt_out_at, status")
          .in("id", cIds)
          .limit(10000);
        if (cData) customers = cData;
      }
    } else {
      const { data: cData } = await adminClient
        .from("customers")
        .select("id, name, email, phone, marketing_opt_in, marketing_opt_out_at, status")
        .limit(10000);
      if (cData) customers = cData;
    }
    
    const raw_audience_count = customers.length;
    
    if (raw_audience_count === 0 && campaign.audience_count > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "static_audience_not_loaded",
          step: "audience_loading",
          raw_audience_count,
          campaign_audience_count: campaign.audience_count
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load Zalo Profiles if needed
    const customerIds = customers.map((c) => c.id);
    const zaloProfilesMap = new Map<string, any>();

    // 6.5 Idempotency Check (Prevent duplicate sending to same customer in same campaign)
    const { data: existingLogs } = await adminClient
      .from("marketing_delivery_logs")
      .select("customer_id")
      .eq("campaign_id", campaign_id)
      .in("status", ["sent", "queued", "provider_sent", "delivered"]);

    const sentCustomerIds = new Set(existingLogs?.map((l: any) => l.customer_id) || []);
    
    // Remove customers who already received this campaign
    customers = customers.filter(c => !sentCustomerIds.has(c.id));

    if (
      effectiveChannel === "zalo" ||
      effectiveChannel === "zalo_oa" ||
      effectiveChannel === "zalo_zns"
    ) {
      // Chunking if too many
      for (let i = 0; i < customerIds.length; i += 1000) {
        const chunk = customerIds.slice(i, i + 1000);
        const { data: zData } = await adminClient
          .from("customer_zalo_profiles")
          .select("customer_id, zalo_id, is_following_oa, zalo_phone")
          .in("customer_id", chunk);
        if (zData) {
          for (const z of zData) {
            zaloProfilesMap.set(z.customer_id, z);
          }
        }
      }
    }

    // 6.6 Query Customer Consents (Source of Truth)
    const consentsMap = new Map<string, any>();
    if (customers.length > 0) {
      const remainingCustomerIds = customers.map(c => c.id);
      for (let i = 0; i < remainingCustomerIds.length; i += 1000) {
        const chunk = remainingCustomerIds.slice(i, i + 1000);
        const { data: consentsData } = await adminClient
          .from("customer_consents")
          .select("customer_id, channel, is_opt_in, opt_out_at")
          .in("customer_id", chunk)
          .eq("is_opt_in", true)
          .is("opt_out_at", null);
        
        if (consentsData) {
          for (const consent of consentsData) {
             const isMatch = (effectiveChannel.includes("email") && consent.channel.includes("email")) || 
                             (effectiveChannel.includes("zalo") && consent.channel.includes("zalo"));
             if (isMatch) {
               consentsMap.set(consent.customer_id, consent);
             }
          }
        }
      }
    }

    // 7. Filtering (Shared Audience Filter)
    let { eligible_count, excluded_counts, preview_recipients, eligible_recipients } =
      buildEligibleAudience(
        customers,
        effectiveChannel,
        zaloProfilesMap,
        suppressionSet,
        consentsMap,
        10000, // Get all eligible
      );

    // 8. Rate Limit Logic
    const max_batch_size = providerMode === "resend_limited_pilot" 
      ? 10 
      : (effectiveChannel === "email" || effectiveChannel === "email_campaign" ? 100 : 10);

    if (eligible_count > max_batch_size) {
      return new Response(
        JSON.stringify({
          success: false,
          error: providerMode === "resend_limited_pilot" 
            ? "limited_pilot_batch_too_large" 
            : `Audience vượt quá giới hạn an toàn. Giới hạn: ${max_batch_size}, Số lượng hợp lệ: ${eligible_count}`,
          eligible_count,
          step: "rate_limit",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 9. Final Confirmation Check
    const { data: latestCamp } = await adminClient
      .from("marketing_campaigns")
      .select("final_confirmed_at, paused_at")
      .eq("id", campaign_id)
      .single();
    if (!latestCamp?.final_confirmed_at) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campaign chưa được xác nhận Final Confirmation.",
          step: "final_confirmation",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (latestCamp?.paused_at) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign đang bị tạm dừng.", step: "paused" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 10. Execute Send
    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          campaign_id: campaign.id,
          channel: effectiveChannel,
          step: "dry_run_success",
          raw_audience_count,
          static_audience_count,
          eligible_count: eligible_recipients.length,
          suppressed_count: excluded_counts.suppressed,
          consent_blocked_count: excluded_counts.no_consent, // Fallback opt_out
          consent_missing_count: excluded_counts.consent_missing_count, // Missing explicit proof
          duplicate_blocked_count: excluded_counts.duplicate,
          invalid_contact_count: excluded_counts.invalid_contact,
          blocked_or_inactive_count: excluded_counts.blocked_or_inactive,
          message: "Dry run completed successfully.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (providerMode === "resend_pilot" || providerMode === "resend_limited_pilot") {
      // 10a. Validate Channel
      if (effectiveChannel !== "email" && effectiveChannel !== "email_campaign") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Pilot mode only supports Email channel.",
            step: "pilot_validation",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 10b. Filter Audience by Whitelist ONLY if resend_pilot
      if (providerMode === "resend_pilot") {
        const whitelistStr = Deno.env.get("INTERNAL_PILOT_RECIPIENTS") || Deno.env.get("TEST_RECIPIENT_WHITELIST") || "";
        const whitelist = whitelistStr.split(",").map((e) => e.trim().toLowerCase());

        if (whitelist.length === 0 || whitelistStr === "") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Whitelist rỗng, không thể chạy Pilot.",
              step: "pilot_whitelist",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        eligible_recipients = eligible_recipients.filter(
          (r) => r.email && whitelist.includes(r.email.toLowerCase()),
        );

        if (eligible_recipients.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Không tìm thấy khách hàng nào trong audience có email trùng với whitelist nội bộ. (no_internal_pilot_recipient)",
              step: "pilot_filter",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // 10c. Resend API Call
      let resendKey = "";
      let fromEmail = "";
      let auth_type = "platform_secret";
      const sender_account_id = campaign.sender_account_id || null;

      try {
        const cred = await resolveResendCredential(adminClient, sender_account_id);
        resendKey = cred.api_key || "";
        fromEmail = cred.from_email || "";
        auth_type = cred.auth_type;
      } catch (e: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: e.message || "Lỗi cấu hình Sender Account Pilot",
            step: "credential_resolution",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const logInserts = [];
      let successCount = 0;

      for (const rec of eligible_recipients) {
        // Prepare template
        const finalSubject = renderTemplate(campaign.draft_subject, {
          customer_name: rec.name || "Customer",
        });
        const finalBody = renderTemplate(campaign.draft_body, {
          customer_name: rec.name || "Customer",
        });

        const publicAppUrl = Deno.env.get("PUBLIC_APP_URL") || "https://hub.desembre-vn.com";
        const unsubscribePayload = {
          customerId: rec.customer_id,
          email: rec.email,
          campaignId: campaign.id
        };
        const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const unsubscribeToken = await generateUnsubscribeToken(unsubscribePayload, tokenEncKey);
        const unsubscribeUrl = `${publicAppUrl}/marketing/unsubscribe?token=${unsubscribeToken}`;
        
        const unsubscribeHtml = `
          <br/><br/>
          <div style="font-size:12px;color:#666;margin-top:20px;padding-top:20px;border-top:1px solid #eee;">
            <p>Bạn nhận được email này vì đã đăng ký nhận thông tin từ DESEMBRE.</p>
            <p><a href="${unsubscribeUrl}" target="_blank" style="color:#666;text-decoration:underline;">Nhấn vào đây để hủy đăng ký (Unsubscribe)</a></p>
          </div>
        `;
        
        const finalHtmlBody = finalBody + unsubscribeHtml;

        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `DESEMBRE Pilot <${fromEmail}>`,
            to: [rec.email],
            subject: finalSubject,
            html: finalHtmlBody,
          }),
        });

        const resendData = await resendResp.json();
        const isOk = resendResp.ok;

        if (isOk) successCount++;

        logInserts.push({
          campaign_id: campaign.id,
          channel: effectiveChannel,
          customer_id: rec.customer_id,
          status: isOk ? "sent" : "failed",
          provider_message_id: isOk ? resendData.id : null,
          reason: isOk ? null : resendData.message || "Resend API Error",
          delivery_metadata: {
            mode: providerMode,
            provider: "resend",
            safety_checks: {
              suppression_checked: true,
              duplicate_checked: true,
              consent_checked: true,
            },
            consent_snapshot: {
              marketing_opt_in: rec.marketing_opt_in,
              opt_out_at: rec.marketing_opt_out_at,
            },
            error: isOk ? null : resendData,
          },
          created_at: new Date().toISOString(),
        });
      }

      if (logInserts.length > 0) {
        await adminClient.from("marketing_delivery_logs").insert(logInserts);
      }

      return new Response(
        JSON.stringify({
          success: true,
          campaign_id: campaign.id,
          channel: effectiveChannel,
          step: "production_pilot_success",
          sent_count: successCount,
          failed_count: logInserts.length - successCount,
          message: "Pilot production send completed.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 11. Mock Provider Loop
    const logInserts = [];

    for (const rec of eligible_recipients) {
      // Create prepared log metadata
      const delivery_metadata = {
        mode: "mock",
        provider: "mock",
        safety_checks: {
          suppression_checked: true,
          duplicate_checked: true,
        },
        consent_snapshot: {
          marketing_opt_in: rec.marketing_opt_in,
          opt_out_at: rec.marketing_opt_out_at,
        },
        dry_run_reference_timestamp: new Date().toISOString(),
        provider_message_id: `mock_${crypto.randomUUID()}`,
      };

      logInserts.push({
        campaign_id: campaign.id,
        channel: campaign.channel,
        customer_id: rec.customer_id,
        status: "sent", // lifecycle: prepared -> sending -> sent (mock fast forward to sent)
        delivery_metadata,
        created_at: new Date().toISOString(),
      });
    }

    // Batch insert logs
    for (let i = 0; i < logInserts.length; i += 100) {
      const chunk = logInserts.slice(i, i + 100);
      await adminClient.from("marketing_delivery_logs").insert(chunk);
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign.id,
        channel: effectiveChannel,
        step: "mock_provider_success",
        eligible_count,
        skipped_count:
          excluded_counts.opt_out + excluded_counts.no_consent + excluded_counts.duplicate,
        blocked_count: excluded_counts.suppressed + excluded_counts.blocked_or_inactive,
        rate_limit: {
          max_batch_size,
          exceeds_limit: false,
        },
        production_sending_enabled: productionSendingEnabled,
        message: "Mock production send completed successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message, step: "unexpected_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
