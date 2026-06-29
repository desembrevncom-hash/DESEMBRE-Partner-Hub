import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkProviderSecretGate } from "../../../src/lib/marketing/providerSecretGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const approvedNames = [
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "RESEND_SANDBOX_TO_ALLOWLIST",
      "ZALO_ZNS_APP_ID",
      "ZALO_ZNS_SECRET_KEY",
      "ZALO_ZNS_OA_ID",
      "ZALO_ZNS_SANDBOX_PHONE_ALLOWLIST",
      "MARKETING_PROVIDER_SANDBOX_MODE",
      "MARKETING_REAL_SEND_ENABLED",
      "MARKETING_EXTERNAL_PROVIDER_CALLS_ENABLED"
    ];

    const envPresence: Record<string, boolean> = {};
    approvedNames.forEach((name) => {
      envPresence[name] = Boolean(Deno.env.get(name));
    });

    const result = checkProviderSecretGate(envPresence);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
