import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { resolveResendCredential } from "../_shared/sender-credentials.ts";

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
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseAdminKey);

    // 1. Auth & Role verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization", step: "auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized", step: "auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).single();
    const role = roleData?.role;
    
    if (role !== "admin" && role !== "sub_admin") {
      return new Response(JSON.stringify({ success: false, error: "Forbidden: Admin/SubAdmin only", step: "role_check" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Parse Body
    const { campaign_id, test_recipient, test_zalo_user_id, sender_account_id } = await req.json();

    if (!campaign_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing campaign_id", step: "validation" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    if (!test_recipient && !test_zalo_user_id) {
      return new Response(JSON.stringify({ success: false, error: "Cần cung cấp email hoặc zalo user id để test", step: "validation" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Load Campaign
    const { data: campaign, error: campErr } = await adminClient
      .from("marketing_campaigns")
      .select("id, channel, draft_subject, draft_body, approval_status, sender_account_id")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ success: false, error: "Chiến dịch không tồn tại", step: "campaign_check" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (campaign.approval_status === "rejected") {
      return new Response(JSON.stringify({ success: false, error: "Chiến dịch đã bị từ chối (Rejected). Không thể test.", step: "campaign_check" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!campaign.draft_subject || !campaign.draft_body) {
      return new Response(JSON.stringify({ success: false, error: "Nội dung Draft Subject / Body bị trống. Vui lòng Save Draft trước.", step: "campaign_check" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const finalSubject = `[TEST SANDBOX] ${renderTemplate(campaign.draft_subject, { customer_name: "Test User" })}`;
    const finalBody = renderTemplate(campaign.draft_body, { customer_name: "Test User" });

    // =========================================================================
    // BRANCH: ZALO
    // =========================================================================
    if (campaign.channel === "zalo" || campaign.channel === "zalo_oa") {
      if (!test_zalo_user_id) {
        return new Response(JSON.stringify({ success: false, error: "Chưa cung cấp test_zalo_user_id", step: "validation" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Check Whitelist
      const whitelistStr = Deno.env.get("ZALO_TEST_ZALO_USER_ID_WHITELIST") || "";
      const whitelist = whitelistStr.split(",").map(e => e.trim());

      if (!whitelist.includes(test_zalo_user_id)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Sandbox Test bị chặn: Zalo User ID không nằm trong Whitelist an toàn.", 
          step: "whitelist_check" 
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Token config
      const { getSenderCredential } = await import("../_shared/sender-credentials.ts");
      let zaloToken: string | null = null;
      try {
        const creds = await getSenderCredential(adminClient, "zalo_oa", sender_account_id);
        zaloToken = creds.access_token || null;
      } catch (err: any) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Lỗi cấu hình Zalo: ${err.message}`, 
          step: "credential_resolver" 
        }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!zaloToken) {
        return new Response(JSON.stringify({ success: false, error: "Thiếu cấu hình ZALO_OA_ACCESS_TOKEN hoặc Token trong DB.", step: "env" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Call Zalo API
      const zaloResp = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
        method: "POST",
        headers: {
          "access_token": zaloToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { user_id: test_zalo_user_id },
          message: { text: finalBody }
        }),
      });

      const zaloData = await zaloResp.json();

      if (zaloData.error !== 0) {
        // -216 or -214 often mean recipient hasn't interacted within 7 days, or didn't follow
        const isRelError = zaloData.error === -216 || zaloData.error === -214 || zaloData.error === -212;
        
        await adminClient.from("marketing_delivery_logs").insert({
          customer_id: null,
          campaign_id: campaign.id,
          channel: "zalo",
          mode: "provider_send",
          status: "test_failed",
          reason: zaloData.message || "Zalo API Error",
          created_by: user.id,
          delivery_metadata: {
            mode: "test",
            campaign_id: campaign.id,
            test_zalo_user_id: test_zalo_user_id,
            provider: "zalo_oa",
            error: zaloData
          }
        });

        return new Response(JSON.stringify({ 
          success: false, 
          error: zaloData.message || "Lỗi khi gọi Zalo API", 
          step: isRelError ? "zalo_relationship" : "provider_send",
          provider_response: zaloData
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Success Log
      const messageId = zaloData.data?.message_id;
      await adminClient.from("marketing_delivery_logs").insert({
        customer_id: null,
        campaign_id: campaign.id,
        channel: "zalo",
        mode: "provider_send",
        status: "test_sent",
        provider_message_id: messageId,
        created_by: user.id,
        delivery_metadata: {
          mode: "test",
          campaign_id: campaign.id,
          test_zalo_user_id: test_zalo_user_id,
          provider: "zalo_oa",
          message_id: messageId
        }
      });

      return new Response(JSON.stringify({
        success: true,
        status: "test_sent",
        provider: "zalo_oa",
        message_id: messageId,
        campaign_id: campaign.id,
        test_zalo_user_id: test_zalo_user_id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }


    // =========================================================================
    // BRANCH: EMAIL
    // =========================================================================
    if (campaign.channel === "email" || campaign.channel === "email_campaign") {
      if (!test_recipient) {
        return new Response(JSON.stringify({ success: false, error: "Chưa cung cấp email để test", step: "validation" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Basic email regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(test_recipient)) {
        return new Response(JSON.stringify({ success: false, error: "Địa chỉ email không hợp lệ", step: "validation" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Check Whitelist
      const whitelistStr = Deno.env.get("TEST_RECIPIENT_WHITELIST") || "";
      const whitelist = whitelistStr.split(",").map(e => e.trim().toLowerCase());

      if (!whitelist.includes(test_recipient.toLowerCase())) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Sandbox Test bị chặn: Email nhận không nằm trong Whitelist an toàn.", 
          step: "whitelist_check" 
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 6. Call Resend API
      let resendKey = "";
      let fromEmail = "";
      let auth_type = "platform_secret";
      
      try {
        const finalSenderAccountId = sender_account_id || campaign.sender_account_id || null;
        const cred = await resolveResendCredential(adminClient, finalSenderAccountId);
        resendKey = cred.api_key || "";
        fromEmail = cred.from_email || "";
        auth_type = cred.auth_type;
      } catch (e: any) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: e.message || "Lỗi cấu hình Sender Account", 
          step: "credential_resolution" 
        }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `DESEMBRE Sandbox <${fromEmail}>`,
          to: [test_recipient],
          subject: finalSubject,
          html: finalBody,
        }),
      });

      const resendData = await resendResp.json();

      if (!resendResp.ok) {
        // 7a. Log Failed Test
        await adminClient.from("marketing_delivery_logs").insert({
          customer_id: null,
          campaign_id: campaign.id,
          channel: "email",
          mode: "provider_send",
          status: "test_failed",
          reason: resendData?.message || "Resend API Error",
          created_by: user.id,
          delivery_metadata: {
            mode: "test",
            campaign_id: campaign.id,
            test_recipient: test_recipient,
            provider: "resend",
            error: resendData
          }
        });

        return new Response(JSON.stringify({ 
          success: false, 
          error: resendData?.message || "Lỗi khi gọi Resend API", 
          step: "provider_send",
          provider_response: resendData
        }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7b. Log Successful Test
      const messageId = resendData?.id;
      await adminClient.from("marketing_delivery_logs").insert({
        customer_id: null,
        campaign_id: campaign.id,
        channel: "email",
        mode: "provider_send",
        status: "test_sent",
        provider_message_id: messageId,
        created_by: user.id,
        delivery_metadata: {
          mode: "test",
          campaign_id: campaign.id,
          test_recipient: test_recipient,
          provider: "resend",
          message_id: messageId
        }
      });

      // 8. Return Success JSON
      return new Response(JSON.stringify({
        success: true,
        status: "test_sent",
        provider: "resend",
        message_id: messageId,
        campaign_id: campaign.id,
        test_recipient: test_recipient
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // If channel is neither email nor zalo
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Channel ${campaign.channel} is not supported for sandbox test`, 
      step: "channel_not_supported" 
    }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message, step: "fatal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
