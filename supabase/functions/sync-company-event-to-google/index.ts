import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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

    // 3. Xác thực người dùng đang đăng nhập thông qua Authorization Header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Tạo client mạo danh user để check xác thực
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      throw new Error("Unauthorized: Invalid user token");
    }

    // Kiểm tra phân quyền: Chỉ Admin hoặc Sub-admin mới được thực thi đồng bộ
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      throw new Error("Forbidden: Unable to verify user role");
    }

    if (profile.role !== "admin" && profile.role !== "sub_admin") {
      throw new Error("Forbidden: Only Admin or Sub-admin can trigger Google Calendar synchronization");
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

    // 6. Lấy Google Access Token từ cơ chế OAuth2 Refresh Token Flow
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
    const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN") || "";
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Google OAuth credentials are not fully configured in Supabase Vault Secrets");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(`Google OAuth Token Refresh Error: ${tokenData.error_description || tokenData.error || JSON.stringify(tokenData)}`);
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

    // 8. Gọi Google Calendar API thực thi chèn dữ liệu
    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gcalPayload),
      }
    );

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
        status: 400, // Trả về lỗi định dạng 400 hoặc 500 để client nắm trọn vẹn
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
