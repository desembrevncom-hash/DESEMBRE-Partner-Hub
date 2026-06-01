import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, X-ZECA-Signature, X-ZECA-Event",
};

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payloadString = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(payloadString);
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        error: "invalid_json",
        step: "parse",
        details: "Invalid JSON payload"
      }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const event_type = payload.event_name || req.headers.get("X-ZECA-Event") || "unknown";
    
    let provider = "zalo";
    let channel = "zalo";
    let secret: string | undefined = undefined;

    if (event_type.startsWith("zns_")) {
      provider = "zalo_zbs";
      channel = "zalo_zbs";
      secret = Deno.env.get("ZALO_APP_SECRET");
      if (!secret) {
        return new Response(JSON.stringify({
          success: false,
          error: "missing_config",
          step: "env",
          details: "ZALO_APP_SECRET is not configured for ZNS."
        }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    } else {
      provider = "zalo";
      channel = "zalo";
      secret = Deno.env.get("ZALO_OA_SECRET_KEY") || Deno.env.get("ZALO_APP_SECRET");
      if (!secret) {
        return new Response(JSON.stringify({
          success: false,
          error: "missing_config",
          step: "env",
          details: "Neither ZALO_OA_SECRET_KEY nor ZALO_APP_SECRET is configured for OA."
        }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // Attempt to extract signature and verify
    // 1. Check for Zalo Cloud API signature (X-ZECA-Signature)
    const zecaSignature = req.headers.get("X-ZECA-Signature");
    const zecaTimestamp = req.headers.get("X-ZECA-Timestamp");
    let signatureValid = false;

    if (zecaSignature && zecaTimestamp) {
      // ZCA Webhook MAC = sha256(appId + jsonBody + timestamp + secretKey)
      const appId = payload.app_id || payload.appId || "";
      const expectedMac = await sha256(appId + payloadString + zecaTimestamp + secret);
      if (expectedMac === zecaSignature) {
        signatureValid = true;
      }
    } else if (payload.mac && payload.app_id && payload.timestamp) {
      // Zalo OA Webhook: mac = sha256(app_id + data + timestamp + secret_key)
      const appIdStr = String(payload.app_id);
      const timestampStr = String(payload.timestamp);
      const dataStr = payload.data ? (typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data)) : "";
      const computedMac = await sha256(appIdStr + dataStr + timestampStr + secret);
      
      if (computedMac === payload.mac) {
        signatureValid = true;
      }
    }

    // If no signature at all → connectivity check from Zalo OA dashboard ("Kiểm tra")
    // Real events always carry either X-ZECA-Signature header or payload.mac field.
    if (!zecaSignature && !payload.mac) {
      return new Response(JSON.stringify({ success: true, message: "connectivity_ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!signatureValid) {
      return new Response(JSON.stringify({
        success: false,
        error: "invalid_signature",
        step: "signature",
        details: "MAC verification failed or missing signature headers."
      }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }



    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "missing_config",
        step: "env",
        details: "Supabase ENV missing."
      }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const message_id = payload.message?.msg_id || payload.msg_id || payload.message_id || "";
    const timestamp = payload.timestamp || zecaTimestamp || Date.now().toString();
    
    // dedupe_key = event_name + message_id + timestamp OR hash payload
    let dedupe_key = `${event_type}_${message_id}_${timestamp}`;
    if (!message_id) {
      dedupe_key = await sha256(payloadString); // Fallback dedupe
    }
    
    // Extract non-sensitive headers
    const redactedHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!["authorization", "cookie", "x-zeca-signature", "mac"].includes(lowerKey)) {
        redactedHeaders[lowerKey] = value;
      }
    });

    const insertData = {
      provider,
      provider_event_id: message_id,
      dedupe_key,
      event_type,
      channel,
      related_message_id: message_id,
      payload,
      headers_redacted: redactedHeaders,
      signature_valid: true,
      status: "received",
      received_at: new Date().toISOString()
    };

    const { error: insertError } = await supabaseAdmin
      .from("webhook_events")
      .insert(insertData);

    if (insertError) {
      if (insertError.code === '23505') { // Unique violation
        return new Response(JSON.stringify({
          success: true,
          message: "duplicate_ignored"
        }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      return new Response(JSON.stringify({
        success: false,
        error: "db_insert_failed",
        step: "db_insert",
        details: insertError.message
      }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: "internal_error",
      step: "parse",
      details: error.message
    }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
