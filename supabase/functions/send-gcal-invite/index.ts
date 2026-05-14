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

  try {
    const { registration_id, event_title, starts_at, ends_at, location, description, attendee_email, attendee_name } = await req.json();

    if (!attendee_email) {
      throw new Error("Khách mời chưa có địa chỉ email.");
    }

    const serviceAccountStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

    if (!serviceAccountStr) {
      throw new Error("Hệ thống chưa được cấu hình khóa GOOGLE_SERVICE_ACCOUNT trong Vault.");
    }

    const serviceAccount = JSON.parse(serviceAccountStr);

    // Lấy JWT Access Token từ Google API
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: await generateJwtAssertion(serviceAccount),
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(`Lỗi xác thực Google: ${tokenData.error_description || tokenData.error}`);
    }

    const { access_token } = tokenData;

    // Chuẩn hóa định dạng thời gian sang RFC3339 hợp lệ cho Google Calendar
    const formatDateTime = (dtStr?: string, isEnd = false) => {
      let baseStr = dtStr;
      if (!baseStr || typeof baseStr !== "string" || !baseStr.trim()) {
        const now = new Date();
        if (isEnd) now.setHours(now.getHours() + 3);
        else now.setHours(now.getHours() + 1);
        return now.toISOString();
      }
      baseStr = baseStr.trim();
      // Nếu chuỗi chỉ có ngày (YYYY-MM-DD), bổ sung giờ
      if (baseStr.length === 10) {
        return isEnd ? `${baseStr}T12:00:00+07:00` : `${baseStr}T08:30:00+07:00`;
      }
      // Nếu chuỗi có dạng YYYY-MM-DDTHH:mm nhưng thiếu giây
      if (baseStr.length === 16) {
        return `${baseStr}:00+07:00`;
      }
      try {
        const d = new Date(baseStr);
        if (isNaN(d.getTime())) return new Date().toISOString();
        return d.toISOString();
      } catch {
        return new Date().toISOString();
      }
    };

    const validStart = formatDateTime(starts_at, false);
    let validEnd = formatDateTime(ends_at, true);

    // Đảm bảo thời gian kết thúc luôn sau thời gian bắt đầu ít nhất 1 giờ
    try {
      const sTime = new Date(validStart).getTime();
      const eTime = new Date(validEnd).getTime();
      if (eTime <= sTime) {
        const adjustedEnd = new Date(sTime + 2 * 3600 * 1000);
        validEnd = adjustedEnd.toISOString();
      }
    } catch (_) {}

    // Chuẩn hóa nội dung mang danh nghĩa Công ty DESEMBRE
    const cleanTitle = event_title || "Sự kiện DESEMBRE Partner";
    const googleEventPayload = {
      summary: `[DESEMBRE] Thư Mời Sự Kiện: ${cleanTitle}`,
      description: `Kính gửi Quý đối tác / Khách mời: ${attendee_name}\n\nCông ty DESEMBRE Việt Nam trân trọng kính mời Quý khách tham dự chương trình đào tạo và chuyển giao phác đồ chuyên sâu.\n\n📌 NỘI DUNG CHUYỂN GIAO:\n${description || ""}\n\nSự hiện diện của Quý khách là niềm vinh hạnh lớn cho công ty chúng tôi.\nTrân trọng,\nBan Giám Đốc DESEMBRE Partner Hub`,
      location: location || "Hệ thống DESEMBRE Việt Nam",
      start: { dateTime: validStart },
      end: { dateTime: validEnd },
      attendees: [
        { email: attendee_email, displayName: attendee_name, responseStatus: "needsAction" }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 48 * 60 }, // Google tự động bắn Email nhắc trước đúng 2 ngày (48 tiếng)
          { method: "popup", minutes: 60 }        // Thông báo đẩy trên app GCal trước 1 tiếng
        ],
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
    };

    // Thử tạo sự kiện trên Lịch chính thức được cấu hình trước
    let gcalResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEventPayload),
      }
    );

    let gcalData = await gcalResponse.json();

    // NẾU BỊ TỪ CHỐI QUYỀN GHI (writer access) hoặc Domain-wide Delegation, TỰ ĐỘNG LÁCH SANG LỊCH NỘI BỘ (primary)
    if (!gcalResponse.ok && (gcalData.error?.message?.includes("writer access") || gcalData.error?.message?.includes("Delegation") || gcalData.error?.status === "PERMISSION_DENIED" || gcalResponse.status === 403)) {
      const fallbackPayload = { ...googleEventPayload };
      // Gỡ bỏ mảng attendees ban đầu để lách qua bộ lọc khởi tạo của Google
      delete (fallbackPayload as any).attendees;

      const primaryResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fallbackPayload),
        }
      );

      const primaryData = await primaryResponse.json();

      if (primaryResponse.ok) {
        // Sau khi sự kiện gốc ra đời trơn tru, thử gọi PATCH để đính kèm khách mời và phát lệnh gửi Email
        const patchResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${primaryData.id}?sendUpdates=all`,
          {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              attendees: googleEventPayload.attendees
            }),
          }
        );
        const patchData = await patchResponse.json();
        gcalResponse = patchResponse.ok ? patchResponse : primaryResponse;
        gcalData = patchResponse.ok ? patchData : primaryData;
      }
    }

    if (!gcalResponse.ok) {
      throw new Error(`Google Calendar API Error: ${gcalData.error?.message || "Unknown error"}`);
    }

    // Cập nhật trạng thái thành công vào Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("event_registrations")
      .update({ 
        google_invite_status: "invited",
        calendar_link_sent_at: new Date().toISOString()
      })
      .eq("id", registration_id);

    return new Response(JSON.stringify({ success: true, google_event_id: gcalData.id, html_link: gcalData.htmlLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
