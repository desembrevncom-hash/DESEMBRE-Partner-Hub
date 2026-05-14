import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper kết xuất nội suy mẫu tin nhắn
function renderTemplate(templateStr: string, varsObj: Record<string, any>): string {
  if (!templateStr) return "";
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = varsObj[key];
    return val === null || val === undefined ? "" : String(val);
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let registrationIdForFallback = "";

  try {
    const { registration_id, template_id, event_title, starts_at, ends_at, location, description, attendee_email, attendee_name } = await req.json();
    if (registration_id) {
      registrationIdForFallback = registration_id;
    }

    if (!attendee_email || !attendee_email.trim()) {
      throw new Error("Khách mời chưa có địa chỉ email hợp lệ.");
    }

    // 1. Kiểm tra Lịch đích bắt buộc
    const targetCalendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

    // 2. Lấy Access Token từ Google (Hỗ trợ Đa luồng: OAuth2 Refresh Token hoặc Service Account)
    const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const serviceAccountStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");

    let access_token = "";
    let usingOAuthUserFlow = false;

    if (refreshToken && clientId && clientSecret) {
      usingOAuthUserFlow = true;
      // Xin token qua OAuth2 Refresh Token (Luồng con người thật - Hỗ trợ Gmail cá nhân)
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          refresh_token: refreshToken.trim(),
          grant_type: "refresh_token",
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        throw new Error(`Xác thực tài khoản cá nhân qua GOOGLE_REFRESH_TOKEN thất bại: ${tokenData.error_description || tokenData.error}`);
      }
      access_token = tokenData.access_token;
    } else if (serviceAccountStr && serviceAccountStr.trim()) {
      // Xin token qua Service Account JWT (Hỗ trợ Google Workspace)
      let serviceAccount: any = null;
      try {
        serviceAccount = JSON.parse(serviceAccountStr);
      } catch (_) {
        throw new Error("Chuỗi GOOGLE_SERVICE_ACCOUNT không đúng định dạng JSON.");
      }

      const impersonateEmail = Deno.env.get("GOOGLE_IMPERSONATE_EMAIL");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: await generateJwtAssertion(serviceAccount, impersonateEmail),
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        const tErr = tokenData.error_description || tokenData.error || "";
        if (tErr.toLowerCase().includes("unauthorized_client") || tErr.toLowerCase().includes("delegation") || tErr.toLowerCase().includes("forbidden")) {
          throw new Error("Service Account chưa bật Domain-Wide Delegation hoặc chưa impersonate email công ty. Hãy cấu hình GOOGLE_IMPERSONATE_EMAIL hoặc chuyển sang OAuth Refresh Token.");
        }
        throw new Error(`Xác thực Google Service Account thất bại: ${tErr}`);
      }
      access_token = tokenData.access_token;
    } else {
      throw new Error("Hệ thống chưa được cấu hình phương thức xác thực Google API. Vui lòng khai báo GOOGLE_REFRESH_TOKEN (kèm Client ID/Secret) hoặc GOOGLE_SERVICE_ACCOUNT trong Supabase Secrets.");
    }

    // Chuẩn hóa thời gian
    const formatDateTime = (dtStr?: string, isEnd = false) => {
      let baseStr = dtStr;
      if (!baseStr || typeof baseStr !== "string" || !baseStr.trim()) {
        const now = new Date();
        if (isEnd) now.setHours(now.getHours() + 3);
        else now.setHours(now.getHours() + 1);
        return now.toISOString();
      }
      baseStr = baseStr.trim();
      if (baseStr.length === 10) {
        return isEnd ? `${baseStr}T12:00:00+07:00` : `${baseStr}T08:30:00+07:00`;
      }
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

    let validEnd = formatDateTime(ends_at, true);
    let validStart = formatDateTime(starts_at, false);

    if (ends_at && ends_at.trim()) {
      const endDatePart = validEnd.slice(0, 10);
      const startTimePart = validStart.slice(11, 19);
      validStart = `${endDatePart}T${startTimePart}${validStart.slice(19)}`;
    }

    try {
      const sTime = new Date(validStart).getTime();
      const eTime = new Date(validEnd).getTime();
      if (eTime <= sTime) {
        const adjustedEnd = new Date(sTime + 2 * 3600 * 1000);
        validEnd = adjustedEnd.toISOString();
      }
    } catch (_) {}

    // Khởi tạo Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Tra cứu dữ liệu Mẫu tin nhắn (Message Templates) để thống nhất khuôn mẫu truyền thông
    let templateData: any = null;
    if (template_id) {
      const { data } = await supabase.from("message_templates").select("*").eq("id", template_id).single();
      templateData = data;
    } else {
      // Ưu tiên mẫu mặc định đang kích hoạt cho kênh calendar_invite
      const { data } = await supabase.from("message_templates")
        .select("*")
        .eq("channel", "calendar_invite")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      templateData = data;
    }

    // Nội suy nội dung từ tập biến
    const finalVars = {
      customer_name: attendee_name || "Quý khách",
      event_title: event_title || "Sự kiện DESEMBRE",
      event_time: starts_at || "Sắp diễn ra",
      event_location: location || "Hệ thống DESEMBRE Việt Nam",
      meeting_url: "https://meet.google.com",
      sale_name: "Chuyên viên Quản trị",
      company_name: "DESEMBRE Partner Hub",
      description: description || "",
    };

    const renderedSubject = templateData?.subject_template
      ? renderTemplate(templateData.subject_template, finalVars)
      : `[DESEMBRE] Thư Mời Sự Kiện: ${event_title || "Partner Hub"}`;

    const renderedBody = templateData?.body_template
      ? renderTemplate(templateData.body_template, finalVars)
      : `Kính gửi Quý đối tác / Khách mời,\n\nCông ty DESEMBRE Việt Nam trân trọng kính mời Quý khách tham dự chương trình đào tạo và chuyển giao phác đồ chuyên sâu.\n\n📌 NỘI DUNG CHUYỂN GIAO:\n${description || ""}\n\nSự hiện diện của Quý khách là niềm vinh hạnh lớn cho công ty chúng tôi.\nTrân trọng,\nBan Giám Đốc DESEMBRE Partner Hub`;

    // 4. Băm ID sự kiện cố định & chuẩn bị danh sách attendees
    let targetEventId = "mastercampaign" + Math.floor(Date.now() / 1000);
    const attendeesMap = new Map<string, any>();

    attendeesMap.set(attendee_email.trim().toLowerCase(), {
      email: attendee_email.trim(),
      displayName: attendee_name || "Khách mời",
    });

    if (registration_id && !registration_id.startsWith("master_")) {
      const { data: currentReg } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("id", registration_id)
        .single();

      if (currentReg && currentReg.event_id) {
        targetEventId = currentReg.event_id;

        const { data: allRegs } = await supabase
          .from("event_registrations")
          .select("customer_name, attendee_email")
          .eq("event_id", targetEventId)
          .not("attendee_email", "is", null);

        if (allRegs && allRegs.length > 0) {
          for (const r of allRegs) {
            if (r.attendee_email && r.attendee_email.includes("@")) {
              attendeesMap.set(r.attendee_email.trim().toLowerCase(), {
                email: r.attendee_email.trim(),
                displayName: r.customer_name || "Khách mời",
              });
            }
          }
        }
      }
    }

    const finalAttendees = Array.from(attendeesMap.values());
    const cleanEventId = targetEventId.replace(/-/g, "").toLowerCase().replace(/[^a-v0-9]/g, "0");
    const deterministicGCalId = "guestinvite" + cleanEventId;

    const googleEventPayload: any = {
      summary: renderedSubject,
      description: renderedBody,
      location: location || "Hệ thống DESEMBRE Việt Nam",
      start: { dateTime: validStart },
      end: { dateTime: validEnd },
      attendees: finalAttendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 48 * 60 },
          { method: "popup", minutes: 60 }
        ],
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
    };

    // Thực thi cập nhật hoặc tạo sự kiện Google Calendar
    const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId.trim())}/events/${encodeURIComponent(deterministicGCalId)}?sendUpdates=all`;
    let gcalResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleEventPayload),
    });

    let gcalData = null;

    if (gcalResponse.ok) {
      gcalData = await gcalResponse.json();
    } else if (gcalResponse.status === 404) {
      googleEventPayload.id = deterministicGCalId;
      const insertUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId.trim())}/events?sendUpdates=all`;
      gcalResponse = await fetch(insertUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEventPayload),
      });

      gcalData = await gcalResponse.json();
    } else {
      gcalData = await gcalResponse.json().catch(() => ({}));
    }

    // Xử lý báo lỗi chi tiết nếu API Google thất bại
    if (!gcalResponse.ok) {
      const errStatus = gcalResponse.status;
      const errMsg = gcalData?.error?.message || JSON.stringify(gcalData);

      if (errMsg.toLowerCase().includes("delegation") || errMsg.toLowerCase().includes("domain-wide") || errMsg.toLowerCase().includes("service accounts cannot invite attendees") || errMsg.toLowerCase().includes("forbidden")) {
        throw new Error("Tài khoản chưa được phân quyền phát hành thư mời. Hãy cấu hình GOOGLE_IMPERSONATE_EMAIL (nếu dùng Service Account) hoặc chuyển sang sử dụng OAuth Refresh Token.");
      }
      if (errStatus === 404 || errMsg.toLowerCase().includes("not found")) {
        throw new Error(`Calendar not found. Không tìm thấy lịch mang ID "${targetCalendarId}". Vui lòng kiểm tra lại cấu hình GOOGLE_CALENDAR_ID hoặc chia sẻ quyền cho tài khoản.`);
      }

      throw new Error(`Google API Error (${errStatus}): ${errMsg}`);
    }

    // 5. Thống nhất trạng thái cập nhật thành "sent"
    if (registration_id && !registration_id.startsWith("master_")) {
      await supabase
        .from("event_registrations")
        .update({ 
          google_invite_status: "sent",
          calendar_link_sent_at: new Date().toISOString()
        })
        .eq("id", registration_id);
    }

    return new Response(JSON.stringify({ success: true, oauth_user_flow: usingOAuthUserFlow, google_event_id: gcalData.id, html_link: gcalData.htmlLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    // 5b. Thống nhất trạng thái cập nhật thành "failed" khi ném lỗi
    if (registrationIdForFallback && !registrationIdForFallback.startsWith("master_")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (supabaseUrl && supabaseServiceKey) {
        const fallbackClient = createClient(supabaseUrl, supabaseServiceKey);
        fallbackClient
          .from("event_registrations")
          .update({ google_invite_status: "failed" })
          .eq("id", registrationIdForFallback)
          .then();
      }
    }

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateJwtAssertion(credentials: any, subjectEmail?: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload: any = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat,
  };

  if (subjectEmail && subjectEmail.trim()) {
    payload.sub = subjectEmail.trim();
  }

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
