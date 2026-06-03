import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { Webhook } from "https://esm.sh/svix@1.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-signature, svix-timestamp",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendWebhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!resendWebhookSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "missing_config",
          step: "env",
          details: "RESEND_WEBHOOK_SECRET is not configured.",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const payloadString = await req.text();
    const svix_id = req.headers.get("svix-id");
    const svix_timestamp = req.headers.get("svix-timestamp");
    const svix_signature = req.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "missing_signature_headers",
          step: "signature",
          details: "Missing Svix headers.",
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const wh = new Webhook(resendWebhookSecret);
    let payload: any;
    try {
      payload = wh.verify(payloadString, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "invalid_signature",
          step: "signature",
          details: err.message,
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "missing_config",
          step: "env",
          details: "Supabase ENV missing.",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const event_type = payload.type || "unknown";
    const dedupe_key = svix_id;
    const provider = "resend";
    const related_message_id = payload.data?.email_id || null;

    // Extract non-sensitive headers
    const redactedHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!["authorization", "cookie", "svix-signature"].includes(lowerKey)) {
        redactedHeaders[lowerKey] = value;
      }
    });

    const insertData = {
      provider,
      provider_event_id: svix_id,
      dedupe_key,
      event_type,
      channel: "email",
      related_message_id,
      payload,
      headers_redacted: redactedHeaders,
      signature_valid: true,
      status: "received",
      received_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseAdmin.from("webhook_events").insert(insertData);

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique violation
        return new Response(
          JSON.stringify({
            success: true,
            message: "duplicate_ignored",
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: "db_insert_failed",
          step: "db_insert",
          details: insertError.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "internal_error",
        step: "parse",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
