import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  
  // Khởi tạo Supabase client quyền Admin để đảm bảo thao tác CSDL an toàn
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { companyEventId, cancelReason } = body;

    if (!companyEventId) {
      throw new Error("Missing required parameter: companyEventId");
    }

    // 1. Truy vấn thông tin Chiến dịch từ CSDL
    const { data: ev, error: evErr } = await supabase
      .from("company_events")
      .select("*")
      .eq("id", companyEventId)
      .single();

    if (evErr || !ev) {
      throw new Error(`Không tìm thấy sự kiện mang ID: ${companyEventId}`);
    }

    // 2. Nếu sự kiện đã được đồng bộ lên Google Calendar, thực thi gỡ bỏ ngầm định
    const gcalEventId = ev.google_calendar_event_id?.trim();
    if (gcalEventId) {
      const serviceAccountStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
      const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

      if (!serviceAccountStr) {
        throw new Error("Hệ thống chưa được cấu hình khóa GOOGLE_SERVICE_ACCOUNT trong Vault Secrets");
      }

      const serviceAccount = JSON.parse(serviceAccountStr);

      // Lấy Access Token từ Service Account JWT Flow
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: await generateJwtAssertion(serviceAccount),
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(`Lỗi xác thực Google Service Account: ${tokenData.error_description || tokenData.error}`);
      }

      const accessToken = tokenData.access_token;

      // Gọi API xóa sự kiện Google Calendar
      const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(gcalEventId)}?sendUpdates=all`;
      const deleteRes = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      // Nếu Google trả về 404 thì vẫn cho tiếp tục (sự kiện có thể đã bị xóa thủ công)
      if (!deleteRes.ok && deleteRes.status !== 404) {
        const errData = await deleteRes.json().catch(() => ({}));
        throw new Error(`Google Calendar API Delete Error: ${errData.error?.message || JSON.stringify(errData)}`);
      }
    }

    // 3. Sau khi xóa Google thành công (hoặc 404 / chưa sync), tiến hành cập nhật trạng thái CRM thành 'cancelled'
    const updatePayload = {
      status: "cancelled",
      google_sync_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason ? cancelReason.trim() : null,
      google_sync_error: null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from("company_events")
      .update(updatePayload)
      .eq("id", companyEventId);

    if (updateErr) {
      throw new Error(`Lỗi cập nhật CSDL CRM: ${updateErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Đã hủy sự kiện CRM và gỡ bỏ Lịch Google thành công",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    const errorMsg = err.message || "Lỗi nội bộ không xác định khi hủy sự kiện";
    console.error("Cancel Error:", errorMsg);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      {
        status: 200, // Trả về HTTP 200 để Supabase JS Relay Client nhận trọn vẹn payload JSON bóc tách mượt mà
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Hàm tạo mã JWT mạo danh Service Account ký bằng thuật toán RSASSA-PKCS1-v1_5 nội bộ Deno
async function generateJwtAssertion(credentials: any) {
  const header = { alg: "RS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat,
  };

  const base64Header = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const base64Payload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${base64Header}.${base64Payload}`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = credentials.private_key.substring(
    credentials.private_key.indexOf(pemHeader) + pemHeader.length,
    credentials.private_key.indexOf(pemFooter)
  ).replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signatureInput}.${base64Signature}`;
}
