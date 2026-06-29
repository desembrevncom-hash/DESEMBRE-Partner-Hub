import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateSandboxGates, GateContext } from "./gates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // Auth client
    const supabaseUserClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userErr } = await supabaseUserClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roleRow } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "Missing job_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: job } = await supabaseAdmin.from("marketing_send_jobs").select("*").eq("id", job_id).single();

    const ctx: GateContext = {
      supabaseUrl,
      isSandboxModeEnabled: Deno.env.get("MARKETING_PROVIDER_SANDBOX_MODE") === "true",
      resendApiKey: Deno.env.get("RESEND_API_KEY"),
      resendFromEmail: Deno.env.get("RESEND_FROM_EMAIL"),
      resendAllowlist: Deno.env.get("RESEND_SANDBOX_TO_ALLOWLIST"),
      userRole: roleRow?.role,
      job
    };

    const gateResult = evaluateSandboxGates(ctx);

    if (!gateResult.allowed) {
      if (gateResult.code === "already_sent") {
         return new Response(JSON.stringify({
            success: true,
            code: gateResult.code,
            message: gateResult.message
         }), { status: gateResult.httpStatus || 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        success: false,
        code: gateResult.code,
        message: gateResult.message
      }), { status: gateResult.httpStatus || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Set sending status
    await supabaseAdmin.from("marketing_send_jobs").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", job_id);

    let providerMessageId = null;
    let isSuccess = false;
    let errorMessage = null;

    if (job.provider === "mock") {
      isSuccess = true;
      providerMessageId = `mock_sandbox_${Date.now()}`;
    } else {
      // Call Resend
      const resendPayload = job.payload || {};
      const bodyPayload = {
        from: ctx.resendFromEmail,
        to: job.recipient_email,
        subject: resendPayload.subject || "Sandbox Test Email",
        html: resendPayload.html || "<p>Sandbox Test</p>"
      };

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ctx.resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });

      const resData = await res.json();
      if (res.ok && resData.id) {
        isSuccess = true;
        providerMessageId = resData.id;
      } else {
        isSuccess = false;
        errorMessage = resData.message || JSON.stringify(resData);
      }
    }

    const safetyResult = {
      ...(job.safety_result || {}),
      sandbox: {
        executed: true,
        provider: job.provider,
        timestamp: new Date().toISOString(),
        success: isSuccess
      }
    };

    if (isSuccess) {
      await supabaseAdmin.from("marketing_send_jobs").update({
        status: "sent",
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        safety_result: safetyResult,
        updated_at: new Date().toISOString()
      }).eq("id", job_id);

      return new Response(JSON.stringify({ success: true, code: "sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      await supabaseAdmin.from("marketing_send_jobs").update({
        status: "failed",
        provider_error_message: errorMessage || "Unknown provider error",
        safety_result: safetyResult,
        updated_at: new Date().toISOString()
      }).eq("id", job_id);

      return new Response(JSON.stringify({ success: false, code: "provider_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
