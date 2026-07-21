import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { normalizePhone } from "../_shared/phoneNormalization.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

function getWebhookSecret() {
  const secret = Deno.env.get("ACADEMY_SMS_HOOK_SECRET");
  if (!secret) {
    throw new Error("Missing ACADEMY_SMS_HOOK_SECRET");
  }
  return secret.replace("v1,whsec_", "");
}

export const ZALO_ZNS_URL = "https://business.openapi.zalo.me/message/template";

// Export the handler for testing
export const handler = async (req: Request): Promise<Response> => {
  console.log("[send-otp-zalo-zns] invoked");
  console.log("[send-otp-zalo-zns] env check", {
    hasHookSecret: Boolean(Deno.env.get("ACADEMY_SMS_HOOK_SECRET")),
    hasTemplateId: Boolean(Deno.env.get("ZALO_ZNS_OTP_TEMPLATE_ID")),
  });
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    let payload: any;
    try {
      const webhook = new Webhook(getWebhookSecret());
      payload = webhook.verify(rawBody, headers);
      console.log("[send-otp-zalo-zns] signature verified");
    } catch (error: any) {
      console.warn("[send-otp-zalo-zns] signature verify failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return new Response(JSON.stringify({ error: "Invalid hook signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ensure payload structure matches Supabase SMS Hook
    if (!payload || !payload.user || !payload.user.phone || !payload.sms || !payload.sms.otp) {
      return new Response(JSON.stringify({ error: "Invalid hook payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawPhone = payload.user.phone;
    const otp = payload.sms.otp;

  console.log("[send-otp-zalo-zns] payload check", {
    hasPhone: Boolean(rawPhone),
    hasOtp: Boolean(otp),
    phoneLast4: rawPhone ? String(rawPhone).slice(-4) : null,
  });

  // 3. Normalize Phone
  const e164Phone = normalizePhone(rawPhone);
  if (!e164Phone) {
    // Supabase will block the login attempt if hook returns error
    return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Zalo ZNS requires 84 prefix without '+'
  const zaloPhone = e164Phone.replace("+", "");

  // 4. Fetch Zalo config
  const templateId = Deno.env.get("ZALO_ZNS_OTP_TEMPLATE_ID");
  const baseUrl = Deno.env.get("ZALO_ZNS_API_BASE_URL") || ZALO_ZNS_URL;

  let znsAccessToken: string | null = null;
  let tokenSource = "static_fallback";
  let selectedSender = "none";
  
  const partnerHubUrl = Deno.env.get("PARTNER_HUB_SUPABASE_URL");
  const partnerHubInternalKey = Deno.env.get("PARTNER_HUB_INTERNAL_FUNCTION_KEY");

  if (partnerHubUrl && partnerHubInternalKey) {
    try {
      const resolveRes = await fetch(`${partnerHubUrl}/functions/v1/resolve-zalo-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": partnerHubInternalKey,
        },
      });

      if (resolveRes.ok) {
        const data = await resolveRes.json();
        znsAccessToken = data.access_token;
        selectedSender = data.sender_name || data.sender_id || "unknown";
        tokenSource = "partner_hub_resolve_api";
      } else {
        const errText = await resolveRes.text();
        console.warn(`[send-otp-zalo-zns] failed to fetch credential from Partner Hub API: ${resolveRes.status} ${errText}`);
      }
    } catch (e: any) {
      console.warn("[send-otp-zalo-zns] failed to connect to Partner Hub API", e.message);
    }
  }

  if (!znsAccessToken && Deno.env.get("ENABLE_ZALO_MOCK_ENV_FALLBACK") === "true") {
    znsAccessToken = Deno.env.get("ZALO_ZNS_ACCESS_TOKEN") || null;
    tokenSource = "env_fallback_dev_only";
  }

  console.log("[send-otp-zalo-zns] credential check", {
    tokenSource,
    hasAccessToken: Boolean(znsAccessToken),
    hasTemplateId: Boolean(templateId),
    phoneLast4: zaloPhone ? String(zaloPhone).slice(-4) : "none"
  });

  if (!znsAccessToken) {
    console.error("[send-otp-zalo-zns] configuration missing: no access token");
    return new Response(JSON.stringify({ error: "Service unavailable", code: "MISSING_ZALO_ACCESS_TOKEN" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!templateId) {
    console.error("[send-otp-zalo-zns] configuration missing: no template ID");
    return new Response(JSON.stringify({ error: "Service unavailable", code: "MISSING_ZALO_ZNS_OTP_TEMPLATE_ID" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Send ZNS Message
  // Do not log OTP.

  try {
    const znsPayload = {
      phone: zaloPhone,
      template_id: templateId,
      template_data: {
        otp: otp,
      },
      tracking_id: payload.user.id,
    };

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 8000); // 8 second timeout

    console.log("[send-otp-zalo-zns] calling Zalo ZNS", {
      phoneLast4: zaloPhone ? String(zaloPhone).slice(-4) : null,
    });

    const znsRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": znsAccessToken,
      },
      body: JSON.stringify(znsPayload),
      signal: abortController.signal,
    });
    
    clearTimeout(timeout);

    console.log("[send-otp-zalo-zns] Zalo response", {
      status: znsRes.status,
      ok: znsRes.ok,
    });

    const znsData = await znsRes.json();

    if (znsData.error !== 0 && znsData.error !== undefined) {
      console.error(`Zalo ZNS API error: ${znsData.error} - ${znsData.message}`);
      
      let statusCode = 500;
      let internalCode = "ZALO_ZNS_ERROR";

      if (znsData.error === -124 || znsData.error === -125) {
        statusCode = 503;
        internalCode = "ACCESS_TOKEN_INVALID";
      } else if (znsData.error === -144) {
        statusCode = 429;
        internalCode = "QUOTA_EXCEEDED";
      } else if (znsData.error === -114) {
        statusCode = 400;
        internalCode = "INVALID_PHONE";
      } else if (znsData.error === -109) {
        statusCode = 503;
        internalCode = "TEMPLATE_ID_INVALID_OR_NOT_APPROVED";
      }

      return new Response(JSON.stringify({ error: "OTP delivery failed", code: internalCode }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Success
    // Supabase Auth SMS Hook expects an empty JSON object on success
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (error: any) {
    console.error("[send-otp-zalo-zns] error", {
      message: error instanceof Error ? error.message : String(error),
    });
    if (error.name === "AbortError") {
      console.error("Zalo ZNS API request timed out.");
      return new Response(JSON.stringify({ error: "OTP delivery timeout" }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    console.error(`Zalo ZNS API request failed: ${error.message}`);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  } catch (error: any) {
    console.error("[send-otp-zalo-zns] error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

if (import.meta.main) {
  serve(handler);
}
