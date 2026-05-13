import { JWT } from "https://esm.sh/google-auth-library@9.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  // Xử lý preflight request CORS cho trình duyệt
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const payload = await req.json();
    const customers = payload.customers || [];
    const stats = payload.stats || {};

    // Trích xuất các biến bí mật môi trường
    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
    let privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") || "";
    const spreadsheetId = Deno.env.get("GOOGLE_SPREADSHEET_ID") || "";

    // Nếu hệ thống chưa cấu hình biến môi trường, tự động trả về dữ liệu thành công ảo (Simulation Mode)
    // Giúp các nhà phát triển và người dùng dễ dàng thử nghiệm tính năng trơn tru mà không bị chặn API
    if (!serviceAccountEmail || !privateKey || !spreadsheetId) {
      console.log("⚠️ Missing Google Secrets. Triggering secure Simulation Mock Sync...");
      return json({
        success: true,
        simulated: true,
        updatedRows: customers.length + 4,
        spreadsheetId: "mock-google-spreadsheet-id-simulation",
        message: "Hệ thống đang chạy ở chế độ Mô phỏng Đồng bộ (Simulation Mode) do chưa cấu hình Khóa Dịch vụ Google. Toàn bộ chuỗi payload dữ liệu hợp lệ đã sẵn sàng."
      });
    }

    // Chuẩn hóa chuỗi Private Key (Xử lý các ký tự xuống dòng bị thoát)
    privateKey = privateKey.replace(/\\n/g, "\n");

    // Khởi tạo máy khách xác thực Google bằng thuật toán JWT tự động
    const client = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    // Lấy Access Token an toàn
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      return json({ error: "Không thể đàm phán mã thông báo truy cập từ Google IAM" }, 500);
    }

    // Chuẩn bị dải ô dữ liệu cần ghi đè (ValueRange)
    const values = [
      ["BÁO CÁO ĐỒNG BỘ DỮ LIỆU CRM - PARTNER HUB ENTERPRISE"],
      [`Thời gian đồng bộ tự động: ${new Date().toISOString()}`],
      [],
      ["ID Khách hàng", "Tên khách hàng", "Cơ sở / Đơn vị", "Số điện thoại", "Trạng thái", "Người phụ trách", "Tiềm năng", "Ngày tạo", "Ngày hẹn Follow-up", "Ghi chú"]
    ];

    customers.forEach((c: any) => {
      values.push([
        c.id || "",
        c.name || "",
        c.facility_name || "",
        String(c.phone || ""),
        c.status || "",
        c.sale_name || "",
        c.potential_level || "",
        c.created_at || "",
        c.next_followup_date || "",
        c.demand_notes || ""
      ]);
    });

    // Ghi đè vào dải ô A1 (Google Sheets API tự động ngầm định trỏ vào trang tính đầu tiên bất kể tên sheet là tiếng Anh hay Việt)
    const targetRange = "A1";
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${targetRange}?valueInputOption=USER_ENTERED`;

    const sheetResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: targetRange,
        majorDimension: "ROWS",
        values: values,
      }),
    });

    const responseData = await sheetResponse.json();

    if (!sheetResponse.ok) {
      // Bắt lỗi điển hình khi tài khoản dịch vụ chưa được gán quyền Editor trên file đích
      const errMsg = responseData.error?.message || "Lỗi giao tiếp Google Sheets API";
      return json({
        success: false,
        error: errMsg,
        isPermissionError: errMsg.includes("Permission denied") || sheetResponse.status === 403,
        serviceEmail: serviceAccountEmail
      }, 400);
    }

    return json({
      success: true,
      simulated: false,
      updatedRows: values.length,
      spreadsheetId: spreadsheetId,
      responseData: responseData
    });
  } catch (error: any) {
    return json({ error: error.message || "Unknown error inside Deno sync logic" }, 500);
  }
});
