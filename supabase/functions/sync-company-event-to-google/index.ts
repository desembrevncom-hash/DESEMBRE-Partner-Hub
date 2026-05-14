import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Xử lý yêu cầu CORS preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // Khởi tạo Supabase client quyền Admin để thao tác an toàn với CSDL
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let companyEventId: string | null = null;

  try {
    // 2. Lấy tham số đầu vào
    const body = await req.json();
    companyEventId = body.companyEventId;

    if (!companyEventId) {
      throw new Error("Missing required parameter: companyEventId");
    }



    // 4. Truy vấn thông tin Chiến dịch từ CSDL
    const { data: ev, error: evErr } = await supabase
      .from("company_events")
      .select("*")
      .eq("id", companyEventId)
      .single();

    if (evErr || !ev) {
      throw new Error(`Event not found for ID: ${companyEventId}`);
    }

    if (!ev.title || !ev.starts_at) {
      throw new Error("Invalid Event Data: Missing title or starts_at metadata");
    }

    // 5. Chuẩn hóa thời gian kết thúc: Nếu ends_at rỗng thì tự set end = starts_at + 1 giờ
    let finalEndsAt = ev.ends_at;
    if (!finalEndsAt) {
      const sDate = new Date(ev.starts_at);
      sDate.setHours(sDate.getHours() + 1);
      finalEndsAt = sDate.toISOString();
    }

    // 6. Lấy Google Access Token từ cơ chế Service Account JWT Flow (Tương thích 100% với cấu hình hiện tại của bạn)
    const serviceAccountStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

    if (!serviceAccountStr) {
      throw new Error("Hệ thống chưa được cấu hình khóa GOOGLE_SERVICE_ACCOUNT trong Vault Secrets");
    }

    const serviceAccount = JSON.parse(serviceAccountStr);

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
      throw new Error(`Google Service Account Auth Error: ${tokenData.error_description || tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    // 7. Khởi tạo cấu trúc payload nạp Sự kiện vào Google Calendar API
    const gcalPayload = {
      summary: ev.title,
      description: ev.description || "",
      location: ev.location || ev.meeting_url || "Hệ thống DESEMBRE Việt Nam",
      start: {
        dateTime: ev.starts_at,
        timeZone: "Asia/Ho_Chi_Minh",
      },
      end: {
        dateTime: finalEndsAt,
        timeZone: "Asia/Ho_Chi_Minh",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // Gửi Email nhắc trước 24 giờ
          { method: "popup", minutes: 60 },      // Thông báo đẩy popup trước 60 phút
        ],
      },
    };

    // 8. Gọi Google Calendar API thực thi chèn hoặc cập nhật dữ liệu (Tránh tạo trùng lặp)
    const hasExistingGCalId = ev.google_calendar_event_id && ev.google_calendar_event_id.trim();
    const gcalApiUrl = hasExistingGCalId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(ev.google_calendar_event_id.trim())}?sendUpdates=all`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`;
    const gcalMethod = hasExistingGCalId ? "PATCH" : "POST";

    const gcalRes = await fetch(gcalApiUrl, {
      method: gcalMethod,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gcalPayload),
    });

    const gcalData = await gcalRes.json();
    if (!gcalRes.ok) {
      throw new Error(`Google Calendar API Error: ${gcalData.error?.message || JSON.stringify(gcalData)}`);
    }

    // 9. Cập nhật trạng thái thành công tuyệt đối vào CSDL
    await supabase
      .from("company_events")
      .update({
        google_calendar_event_id: gcalData.id,
        google_calendar_html_link: gcalData.htmlLink,
        google_sync_status: "synced",
        google_synced_at: new Date().toISOString(),
        google_sync_error: null,
      })
      .eq("id", companyEventId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Synchronized company event to Google Calendar successfully",
        googleEventId: gcalData.id,
        googleEventLink: gcalData.htmlLink,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    // 10. Ghi nhận lỗi đồng bộ và cập nhật trạng thái failed vào CSDL
    const errorMsg = err.message || "Unknown internal synchronization error";
    console.error("Sync Error:", errorMsg);

    if (companyEventId) {
      // Thực thi cập nhật bất đồng bộ trạng thái lỗi để lưu vết
      supabase
        .from("company_events")
        .update({
          google_sync_status: "failed",
          google_sync_error: errorMsg,
        })
        .eq("id", companyEventId)
        .then();
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      {
        status: 200, // Trả về HTTP 200 để Supabase JS Relay Client nhận trọn vẹn payload JSON chứa chuỗi thông báo lỗi gốc
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
