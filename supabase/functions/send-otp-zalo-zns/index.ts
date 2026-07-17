import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { normalizePhone } from "../_shared/phoneNormalization.ts";

export const ZALO_ZNS_URL = "https://business.openapi.zalo.me/message/template";

// Export the handler for testing
export const handler = async (req: Request): Promise<Response> => {
  // 1. Verify Hook Secret (if configured)
  const hookSecret = Deno.env.get("ACADEMY_SMS_HOOK_SECRET");
  if (hookSecret) {
    const authHeader = req.headers.get("Authorization");
    // Standard Supabase hooks typically send "Bearer <secret>" or we check X-Supabase-Hook-Secret.
    // Let's support both for safety.
    const hookHeader = req.headers.get("X-Supabase-Hook-Secret");
    if (authHeader !== `Bearer ${hookSecret}` && hookHeader !== hookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 2. Parse payload
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Malformed payload" }), {
      status: 400,
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
  const znsAccessToken = Deno.env.get("ZALO_ZNS_ACCESS_TOKEN");
  const templateId = Deno.env.get("ZALO_ZNS_OTP_TEMPLATE_ID");
  
  // ZALO_ZNS_API_BASE_URL is optional, fallback to default ZNS URL
  const baseUrl = Deno.env.get("ZALO_ZNS_API_BASE_URL") || ZALO_ZNS_URL;

  if (!znsAccessToken || !templateId) {
    console.error("Zalo ZNS configuration missing.");
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Send ZNS Message
  // Do not log OTP.
  console.log(`Sending Zalo ZNS OTP to formatted phone: ${zaloPhone}`);

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

    const znsData = await znsRes.json();

    // Zalo API typically returns 200 OK but has an "error" field for application-level errors
    // error: 0 means success.
    if (znsData.error !== 0 && znsData.error !== undefined) {
      console.error(`Zalo ZNS API error: ${znsData.error} - ${znsData.message}`);
      
      let statusCode = 500;
      if (znsData.error === -124 || znsData.error === -125) {
        // Token invalid/expired
        statusCode = 503;
      } else if (znsData.error === -144) {
        // Rate limited / quota exceeded
        statusCode = 429;
      } else if (znsData.error === -114) {
         // Invalid phone
         statusCode = 400;
      }

      return new Response(JSON.stringify({ error: "OTP delivery failed", code: znsData.error }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Success
    return new Response(JSON.stringify({ success: true, message: "OTP sent successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (error: any) {
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
};

if (import.meta.main) {
  serve(handler);
}
