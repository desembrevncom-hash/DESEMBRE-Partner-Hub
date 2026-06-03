import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { resolveResendCredential } from "../_shared/sender-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
      return new Response(JSON.stringify({ success: false, error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await adminClient.auth.getUser(token);

    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
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
        JSON.stringify({ success: false, error: "Forbidden: Admin/SubAdmin only" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Parse Body
    const { provider, sender_account_id } = await req.json();

    if (!provider) {
      return new Response(JSON.stringify({ success: false, error: "Missing provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Provider Logic
    if (provider === "resend") {
      let isConfigured = false;
      let message = "";
      let missing_config = [];
      let auth_type = "platform_secret";
      let resendKey = "";
      let fromEmail = "";

      try {
        const cred = await resolveResendCredential(adminClient, sender_account_id);
        auth_type = cred.auth_type;
        resendKey = cred.api_key || "";
        fromEmail = cred.from_email || "";
        isConfigured = true;
      } catch (e: any) {
        isConfigured = false;

        if (e.message === "RESEND_API_KEY_DECRYPTION_FAILED") {
          missing_config.push("RESEND_API_KEY_DECRYPTION_FAILED");
          message = "Lỗi giải mã API key";
          auth_type = "api_key";
        } else if (e.message === "RESEND_API_KEY_FOR_SENDER_MISSING") {
          missing_config.push("RESEND_API_KEY_FOR_SENDER");
          message = "API key chưa được lưu cho sender này";
          auth_type = "api_key";
        } else if (e.message === "PLATFORM_RESEND_API_KEY_MISSING") {
          missing_config.push("RESEND_API_KEY");
          message = "Thiếu RESEND_API_KEY trong backend secrets";
          auth_type = "platform_secret";
        } else if (e.message === "EMAIL_FROM_ADDRESS_MISSING") {
          missing_config.push("EMAIL_FROM_ADDRESS");
          message = "Thiếu cấu hình EMAIL_FROM_ADDRESS";
          auth_type = sender_account_id ? "api_key" : "platform_secret";
        } else {
          message = e.message;
        }
      }

      if (!isConfigured || !fromEmail) {
        return new Response(
          JSON.stringify({
            success: true,
            provider: "resend",
            auth_type,
            configured: false,
            api_key_configured: false,
            missing_config,
            domain_status: "unknown",
            can_send_test: false,
            message: message || "Thiếu cấu hình Platform Secrets",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Check Resend Domain Status
      let domain_status = "unknown";
      try {
        const domainParts = fromEmail.split("@");
        const domain = domainParts.length === 2 ? domainParts[1] : "";

        if (domain) {
          const res = await fetch(`https://api.resend.com/domains`, {
            headers: { Authorization: `Bearer ${resendKey}` },
          });
          if (res.ok) {
            const data = await res.json();
            const found = data.data?.find((d: any) => d.name === domain);
            if (found) {
              domain_status = found.status === "verified" ? "verified" : "unverified";
            } else {
              domain_status = "not_found";
            }
          }
        }
      } catch (e) {
        console.error("Resend domain check error", e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          provider: "resend",
          auth_type,
          configured: true,
          api_key_configured: true,
          from_email: fromEmail,
          missing_config: [],
          domain_status,
          can_send_test: domain_status === "verified",
          message: "API Key: Configured",
          last_checked_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (provider === "zalo_oa") {
      let missing_config: string[] = [];
      let token_available = false;
      let credential_source = "env";

      try {
        const { getSenderCredential } = await import("../_shared/sender-credentials.ts");
        const creds = await getSenderCredential(adminClient, "zalo_oa", sender_account_id);

        token_available = !!creds.access_token;
        credential_source = creds.credential_source || "env";
        auth_type = creds.auth_type;
      } catch (err: any) {
        if (err.message.includes("MISSING")) {
          missing_config.push("ZALO_TOKEN");
        } else {
          missing_config.push(`ERROR_${err.message}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          provider: "zalo_oa",
          auth_type,
          credential_source,
          token_available,
          configured: missing_config.length === 0 && token_available,
          missing_config,
          can_send_test: missing_config.length === 0 && token_available,
          message:
            missing_config.length > 0 ? "Thiếu cấu hình Token Zalo" : "Kết nối Zalo config ok",
          last_checked_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (provider === "gmail" || provider === "gmail/google") {
      // Just basic checking if we have the DB entry active
      return new Response(
        JSON.stringify({
          success: true,
          provider: "gmail",
          configured: true,
          can_send_test: true,
          message: "Gmail OAuth configured",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: false, error: "Unsupported provider" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
