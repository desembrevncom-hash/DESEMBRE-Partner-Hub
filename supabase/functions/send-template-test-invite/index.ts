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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
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

    if (!templateId || !testEmail) {
      throw new Error("Vui lòng cung cấp tham số templateId và testEmail");
    }

    // 1. Kiểm tra Lịch đích bắt buộc
    const targetCalendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

    // 2. Xác thực danh tính người gọi
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Vui lòng đăng nhập để thực hiện gửi kiểm thử");
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
    }
    userId = user.id;

    // Kiểm tra phân quyền từ bảng user_roles (Chỉ Admin hoặc Sub-Admin mới được gửi Test)
    const { data: userRoleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = userRoleData?.role || user.user_metadata?.role;
    if (role !== "admin" && role !== "sub_admin") {
      throw new Error("Hành động bị từ chối: Chỉ Quản trị viên (Admin/Sub-Admin) mới có quyền gửi lịch thử nghiệm.");
    }

    // 3. Tra cứu dữ liệu Mẫu tin nhắn
    const { data: templateData, error: tplErr } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (tplErr || !templateData) {
      throw new Error("Không tìm thấy Mẫu tin nhắn trong cơ sở dữ liệu.");
    }

    // Chuẩn bị tập biến nội suy
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

    const renderedSubject = renderTemplate(templateData.subject_template || "[Thử nghiệm] Thư mời: {{event_title}}", finalVars);
    const renderedBody = renderTemplate(templateData.body_template, finalVars);

    // Thời điểm sự kiện: Sáng mai
    const startDt = new Date();
    startDt.setDate(startDt.getDate() + 1);
    startDt.setHours(9, 0, 0, 0);
    const endDt = new Date(startDt.getTime() + 3600 * 1000);

    // 4. Kiến trúc xác thực Đa luồng: Ưu tiên OAuth2 Refresh Token nếu có
    const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const serviceAccountStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");

    let access_token = "";
    let hasAttendees = false;
    let warningMsg: string | undefined = undefined;
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
      hasAttendees = true; // Gmail cá nhân thật luôn được quyền phát hành email mời
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
      if (impersonateEmail && impersonateEmail.trim()) {
        hasAttendees = true;
      } else {
        warningMsg = "chưa gửi email invite vì chưa cấu hình Domain-Wide Delegation.";
      }
    } else {
      throw new Error("Hệ thống chưa được cấu hình phương thức xác thực Google API. Vui lòng khai báo GOOGLE_REFRESH_TOKEN (kèm Client ID/Secret) hoặc GOOGLE_SERVICE_ACCOUNT trong Supabase Secrets.");
    }

    // 5. Xây dựng Payload sự kiện
    const googleEventPayload: any = {
      summary: renderedSubject,
      description: renderedBody,
      location: finalVars.event_location,
      start: { dateTime: startDt.toISOString() },
      end: { dateTime: endDt.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 }
        ],
      },
    };

    if (hasAttendees) {
      googleEventPayload.attendees = [{ email: testEmail.trim() }];
    }

    // 6. Gửi yêu cầu tạo sự kiện tới Google Calendar API
    const insertUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId.trim())}/events?sendUpdates=all`;
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
      const errStatus = gcalResponse.status;
      const errMsg = gcalData?.error?.message || JSON.stringify(gcalData);

      if (errMsg.toLowerCase().includes("delegation") || errMsg.toLowerCase().includes("domain-wide") || errMsg.toLowerCase().includes("service accounts cannot invite attendees") || errMsg.toLowerCase().includes("forbidden")) {
        throw new Error("Tài khoản chưa được phân quyền phát hành thư mời. Hãy cấu hình GOOGLE_IMPERSONATE_EMAIL (nếu dùng Service Account) hoặc kiểm tra lại OAuth scopes.");
      }
      if (errStatus === 404 || errMsg.toLowerCase().includes("not found")) {
        throw new Error(`Calendar not found. Không tìm thấy lịch mang ID "${targetCalendarId}". Vui lòng đảm bảo đã chia sẻ quyền ghi lịch này cho ứng dụng.`);
      }

      throw new Error(`Google API Error (${errStatus}): ${errMsg}`);
    }

    // 7. Ghi Log thành công
    await supabase.from("template_test_logs").insert([{
      template_id: templateId || null,
      calendar_account_id: calendarAccountId || null,
      tested_by: userId,
      test_email: testEmail.trim(),
      status: hasAttendees ? "sent" : "not_sent",
      provider_response: { ...gcalData, oauth_user_flow: usingOAuthUserFlow, domain_delegation_warning: warningMsg }
    }]);

    return new Response(JSON.stringify({ 
      success: true, 
      has_attendees: hasAttendees,
      warning: warningMsg,
      google_event_id: gcalData.id, 
      html_link: gcalData.htmlLink,
      rendered_subject: renderedSubject
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    // Ghi Log thất bại
    if (userId) {
      supabase.from("template_test_logs").insert([{
        template_id: templateId || null,
        calendar_account_id: calendarAccountId || null,
        tested_by: userId,
        test_email: testEmail ? testEmail.trim() : "unknown",
        status: "failed",
        error_message: error.message
      }]).then();
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
