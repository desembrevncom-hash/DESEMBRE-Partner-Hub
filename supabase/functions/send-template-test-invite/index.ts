import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper nhúng nội suy mẫu tin nhắn độc lập cho Edge Function
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  
  // Khởi tạo Supabase client quyền Admin để lưu Log và tra cứu an toàn
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let templateId = "";
  let calendarAccountId = "";
  let testEmail = "";
  let userId = null;

  try {
    const body = await req.json();
    templateId = body.templateId;
    calendarAccountId = body.calendarAccountId;
    testEmail = body.testEmail;

    if (!templateId || !calendarAccountId || !testEmail) {
      throw new Error("Vui lòng cung cấp đầy đủ các tham số: templateId, calendarAccountId và testEmail");
    }

    // 1. Xác thực danh tính và quyền hạn của người gọi (Chỉ Admin / Sub-Admin)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Vui lòng đăng nhập để sử dụng tính năng thử nghiệm mẫu tin nhắn");
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
    }

    userId = user.id;
    const role = user.user_metadata?.role;
    if (role !== "admin" && role !== "sub_admin") {
      // Truy vấn trực tiếp DB đề phòng cache
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin" && profile?.role !== "sub_admin") {
        throw new Error("Hành động bị từ chối: Chỉ Quản trị viên mới có quyền gửi lịch thử nghiệm.");
      }
    }

    // 2. Tra cứu dữ liệu Mẫu tin nhắn (Message Template)
    const { data: templateData, error: tplErr } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (tplErr || !templateData) {
      throw new Error("Không tìm thấy Mẫu tin nhắn mang ID được yêu cầu.");
    }

    // 3. Tra cứu dữ liệu Tài khoản Lịch Google nguồn (Calendar Account)
    const { data: calAccountData, error: calErr } = await supabase
      .from("google_calendar_accounts")
      .select("*")
      .eq("id", calendarAccountId)
      .single();

    if (calErr || !calAccountData) {
      throw new Error("Không tìm thấy Cấu hình Tài khoản Lịch Google nguồn.");
    }

    const targetCalendarId = calAccountData.calendar_id?.trim() || "primary";

    // 4. Chuẩn bị dữ liệu biến nội suy (Sử dụng sample_variables hoặc biến mặc định cao cấp)
    const defaultSampleVars = {
      customer_name: "Khách Hàng Thử Nghiệm",
      event_title: "Sự Kiện Demo Google Calendar",
      event_time: "09:00 Sáng Ngày Mai",
      event_location: "Hệ thống Trực tuyến DESEMBRE",
      meeting_url: "https://meet.google.com/test-demo",
      sale_name: user.user_metadata?.full_name || "Chuyên Viên Quản Trị",
      calendar_link: "https://calendar.google.com/calendar/render?action=TEMPLATE",
      company_name: "DESEMBRE Partner Hub",
    };

    const finalVars = {
      ...defaultSampleVars,
      ...(templateData.sample_variables || {})
    };

    // Kết xuất Tiêu đề và Nội dung
    const renderedSubject = renderTemplate(templateData.subject_template || "[Thử nghiệm] Thư mời: {{event_title}}", finalVars);
    const renderedBody = renderTemplate(templateData.body_template, finalVars);

    // 5. Thiết lập mốc thời gian thử nghiệm: start = now + 1 ngày, end = start + 1 giờ
    const startDt = new Date();
    startDt.setDate(startDt.getDate() + 1);
    startDt.setHours(9, 0, 0, 0); // Neo lúc 9h sáng ngày mai
    const endDt = new Date(startDt.getTime() + 3600 * 1000); // Kéo dài 1 tiếng

    // 6. Tải Google Service Account từ Vault Secrets
    const serviceAccountStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
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
      throw new Error(`Xác thực Google Service Account thất bại: ${tokenData.error_description || tokenData.error}`);
    }

    const { access_token } = tokenData;

    // 7. Xây dựng Payload sự kiện Google Calendar
    const googleEventPayload = {
      summary: renderedSubject,
      description: renderedBody,
      location: finalVars.event_location,
      start: { dateTime: startDt.toISOString() },
      end: { dateTime: endDt.toISOString() },
      attendees: [{ email: testEmail.trim() }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 }
        ],
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
    };

    // Thực thi gọi Google API chèn sự kiện thử nghiệm
    const insertUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events?sendUpdates=all`;
    const gcalResponse = await fetch(insertUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleEventPayload),
    });

    const gcalData = await gcalResponse.json();

    if (!gcalResponse.ok) {
      throw new Error(`Google API Error: ${gcalData.error?.message || JSON.stringify(gcalData)}`);
    }

    // 8. Lưu Log thành công vào bảng template_test_logs
    await supabase.from("template_test_logs").insert([{
      template_id: templateId,
      calendar_account_id: calendarAccountId,
      tested_by: userId,
      test_email: testEmail.trim(),
      status: "sent",
      provider_response: gcalData
    }]);

    return new Response(JSON.stringify({ 
      success: true, 
      google_event_id: gcalData.id, 
      html_link: gcalData.htmlLink,
      rendered_subject: renderedSubject
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    // Lưu Log thất bại nếu đã lấy được thông tin cơ bản
    if (userId && templateId && calendarAccountId) {
      supabase.from("template_test_logs").insert([{
        template_id: templateId,
        calendar_account_id: calendarAccountId,
        tested_by: userId,
        test_email: testEmail ? testEmail.trim() : "unknown",
        status: "failed",
        error_message: error.message
      }]).then();
    }

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400, // Kích hoạt bóc tách trực tiếp trên client
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
