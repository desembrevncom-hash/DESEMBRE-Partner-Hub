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
    const payload = await req.json();
    const {
      registration_id,
      template_id,
      event_title,
      starts_at,
      ends_at,
      location,
      description,
      attendee_email,
      attendee_name,
      senderAccountId,
    } = payload;

    if (registration_id) {
      registrationIdForFallback = registration_id;
    }

    if (!attendee_email || !attendee_email.trim()) {
      throw new Error("Khách mời chưa có địa chỉ email hợp lệ.");
    }

    // Khởi tạo Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Tra cứu thông tin Tài khoản Nguồn gửi động từ bảng sender_accounts
    let senderAcc: any = null;

    if (senderAccountId && senderAccountId.trim()) {
      const { data, error } = await supabase
        .from("sender_accounts")
        .select("*")
        .eq("id", senderAccountId.trim())
        .single();

      if (!error && data) senderAcc = data;
    }

    // Fallback: Tự động trích xuất tài khoản mặc định gốc nếu frontend không truyền ID
    if (!senderAcc) {
      const { data, error } = await supabase
        .from("sender_accounts")
        .select("*")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        throw new Error(
          "Không tìm thấy tài khoản nguồn gửi hợp lệ. Vui lòng vào Cấu hình -> Quản lý Mẫu Thư Mời để thiết lập tài khoản Lịch Google.",
        );
      }
      senderAcc = data;
    }

    if (!senderAcc.is_active) {
      throw new Error(`Tài khoản gửi "${senderAcc.name}" hiện đang bị vô hiệu hóa.`);
    }

    const prefix = senderAcc.secret_prefix;
    if (!prefix) {
      throw new Error("Tài khoản gửi chưa được thiết lập tiền tố bí mật (Secret Prefix).");
    }

    // 2. Đọc động các thông số OAuth từ Supabase Vault / Deno Environment
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

    // 3. Xin cấp Access Token mới qua luồng OAuth2 Refresh Token (Luồng con người thật)
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
        `Xác thực tài khoản qua OAuth Refresh Token thất bại: ${tokenData.error_description || tokenData.error}`,
      );
    }
    const access_token = tokenData.access_token;

    // 4. Chuẩn hóa thời gian
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

    // 5. Tra cứu dữ liệu Mẫu tin nhắn (Message Templates) để thống nhất khuôn mẫu
    let templateData: any = null;
    if (template_id) {
      const { data } = await supabase
        .from("message_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      templateData = data;
    } else {
      // Ưu tiên mẫu mặc định đang kích hoạt cho kênh calendar_invite
      const { data } = await supabase
        .from("message_templates")
        .select("*")
        .eq("channel", "calendar_invite")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      templateData = data;
    }

    // Nội suy nội dung từ tập biến thực tế
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

    // 6. Băm ID sự kiện cố định & chuẩn bị danh sách attendees
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

        // Tải toàn bộ danh sách đăng ký cùng event để đồng bộ hóa danh sách mời
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
    const cleanEventId = targetEventId
      .replace(/-/g, "")
      .toLowerCase()
      .replace(/[^a-v0-9]/g, "0");
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
          { method: "popup", minutes: 60 },
        ],
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
    };

    // 7. Thực thi cập nhật hoặc tạo sự kiện Google Calendar
    const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId.trim())}/events/${encodeURIComponent(deterministicGCalId)}?sendUpdates=all`;
    let gcalResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
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
          Authorization: `Bearer ${access_token}`,
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

      if (errStatus === 404 || errMsg.toLowerCase().includes("not found")) {
        throw new Error(
          `Calendar not found. Không tìm thấy lịch mang ID "${targetCalendarId}". Vui lòng kiểm tra lại cấu hình Lịch đích trên tài khoản "${senderAcc.name}".`,
        );
      }

      throw new Error(`Google API Error (${errStatus}): ${errMsg}`);
    }

    // 8. Thống nhất cập nhật trạng thái thành "sent"
    if (registration_id && !registration_id.startsWith("master_")) {
      await supabase
        .from("event_registrations")
        .update({
          google_invite_status: "sent",
          calendar_link_sent_at: new Date().toISOString(),
        })
        .eq("id", registration_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_used: senderAcc.name,
        secret_prefix: prefix,
        google_event_id: gcalData.id,
        html_link: gcalData.htmlLink,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    // Thống nhất cập nhật trạng thái thành "failed" khi ném lỗi
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
