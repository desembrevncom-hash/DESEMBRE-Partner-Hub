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
  const supabaseServiceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let templateId = "";
  let senderAccountId = "";
  let testEmail = "";
  let userId = null;

  try {
    const body = await req.json();
    templateId = body.templateId;
    senderAccountId = body.senderAccountId;
    testEmail = body.testEmail;

    if (!templateId || !senderAccountId || !testEmail) {
      throw new Error("Vui lòng cung cấp đủ tham số templateId, senderAccountId và testEmail");
    }

    // 1. Xác thực danh tính người gọi
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Vui lòng đăng nhập để thực hiện gửi kiểm thử");
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
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
      throw new Error(
        "Hành động bị từ chối: Chỉ Quản trị viên (Admin/Sub-Admin) mới có quyền gửi lịch thử nghiệm.",
      );
    }

    // 2. Tra cứu dữ liệu Mẫu tin nhắn
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
      ...(templateData.sample_variables || {}),
    };

    const renderedSubject = renderTemplate(
      templateData.subject_template || "[Thử nghiệm] Thư mời: {{event_title}}",
      finalVars,
    );
    const renderedBody = renderTemplate(templateData.body_template, finalVars);

    // Thời điểm sự kiện: Sáng mai
    const startDt = new Date();
    startDt.setDate(startDt.getDate() + 1);
    startDt.setHours(9, 0, 0, 0);
    const endDt = new Date(startDt.getTime() + 3600 * 1000);

    // 3. Tra cứu thông tin Tài khoản Nguồn gửi từ CSDL Supabase
    const { data: senderAcc, error: errSender } = await supabase
      .from("sender_accounts")
      .select("*")
      .eq("id", senderAccountId)
      .single();

    if (errSender || !senderAcc) {
      throw new Error("Không tìm thấy tài khoản nguồn gửi trong hệ thống.");
    }

    if (!senderAcc.is_active) {
      throw new Error(`Tài khoản gửi "${senderAcc.name}" hiện đang bị vô hiệu hóa.`);
    }

    const prefix = senderAcc.secret_prefix;
    if (!prefix) {
      throw new Error("Tài khoản gửi chưa được thiết lập tiền tố bí mật (Secret Prefix).");
    }

    // 4. Đọc động các thông số OAuth từ Supabase Vault / Deno Environment
    const clientId = Deno.env.get(`${prefix}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${prefix}_CLIENT_SECRET`);
    const refreshToken = Deno.env.get(`${prefix}_REFRESH_TOKEN`);
    const targetCalendarId =
      Deno.env.get(`${prefix}_CALENDAR_ID`) || senderAcc.calendar_id || "primary";

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        `Hệ thống chưa được nạp đủ bộ bí mật OAuth cho tiền tố "${prefix}". Vui lòng khai báo các biến: ${prefix}_CLIENT_ID, ${prefix}_CLIENT_SECRET và ${prefix}_REFRESH_TOKEN trong Supabase Secrets.`,
      );
    }

    // 5. Xin cấp Access Token mới qua luồng OAuth2 Refresh Token
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
      throw new Error(
        `Xác thực tài khoản "${senderAcc.name}" qua Refresh Token thất bại: ${tokenData.error_description || tokenData.error}`,
      );
    }

    const access_token = tokenData.access_token;
    const hasAttendees = true; // Luồng con người thật xác thực bằng OAuth2 luôn hỗ trợ đính kèm khách mời

    // 6. Xây dựng Payload sự kiện
    const googleEventPayload: any = {
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
          { method: "popup", minutes: 30 },
        ],
      },
    };

    // 7. Gửi yêu cầu tạo sự kiện tới Google Calendar API
    const insertUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId.trim())}/events?sendUpdates=all`;
    const gcalResponse = await fetch(insertUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleEventPayload),
    });

    const gcalData = await gcalResponse.json();

    if (!gcalResponse.ok) {
      const errStatus = gcalResponse.status;
      const errMsg = gcalData?.error?.message || JSON.stringify(gcalData);

      if (errStatus === 404 || errMsg.toLowerCase().includes("not found")) {
        throw new Error(
          `Không tìm thấy lịch mang ID "${targetCalendarId}". Vui lòng đảm bảo tài khoản nguồn có quyền truy cập Lịch này.`,
        );
      }

      throw new Error(`Google API Error (${errStatus}): ${errMsg}`);
    }

    // 8. Ghi Log thành công (lưu trực tiếp sender_account_id liên kết)
    await supabase.from("template_test_logs").insert([
      {
        template_id: templateId || null,
        sender_account_id: senderAccountId || null,
        tested_by: userId,
        test_email: testEmail.trim(),
        status: "sent",
        provider_response: {
          ...gcalData,
          sender_prefix: prefix,
          sender_email: senderAcc.sender_email,
        },
      },
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        has_attendees: true,
        google_event_id: gcalData.id,
        html_link: gcalData.htmlLink,
        rendered_subject: renderedSubject,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    // Ghi Log thất bại
    if (userId) {
      supabase
        .from("template_test_logs")
        .insert([
          {
            template_id: templateId || null,
            sender_account_id: senderAccountId || null,
            tested_by: userId,
            test_email: testEmail ? testEmail.trim() : "unknown",
            status: "failed",
            error_message: error.message,
          },
        ])
        .then();
    }

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
