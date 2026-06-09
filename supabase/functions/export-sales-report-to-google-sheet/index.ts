import { JWT } from "https://esm.sh/google-auth-library@9.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const { saleId, reportType, periodStart, periodEnd } = await req.json();

    if (!saleId || !reportType || !periodStart || !periodEnd) {
      return json({ success: false, error: "Missing required parameters" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return json({ success: false, error: "Server configuration missing" }, 500);
    }

    const token = authHeader.replace("Bearer ", "");

    // 1. Create User-Authenticated Client to run RPC with proper RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    // Call RPC using the user's token (RLS will automatically enforce admin vs sale logic)
    const { data: reportData, error: rpcError } = await userClient.rpc("get_sales_performance_report", {
      p_sale_user_id: saleId,
      p_report_type: reportType,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    if (rpcError) {
      return json({ success: false, error: "Lỗi truy xuất dữ liệu báo cáo", details: rpcError.message }, 403);
    }

    // 2. Create Service Role Client ONLY for sales_report_exports
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Export Record
    const { data: exportRecord, error: exportError } = await serviceClient
      .from("sales_report_exports")
      .upsert({
        sale_user_id: saleId,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        export_status: "pending",
        exported_by: user.id,
        error_message: null
      }, { onConflict: "sale_user_id,report_type,period_start,period_end" })
      .select()
      .single();

    if (exportError) {
      return json({ success: false, error: "Failed to create export record", details: exportError.message }, 500);
    }

    const exportId = exportRecord.id;

    try {
      // 3. Authenticate with Google
      const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
      let privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") || "";
      const folderId = Deno.env.get("GOOGLE_DRIVE_REPORT_FOLDER_ID") || "";
      const shareMode = Deno.env.get("GOOGLE_SHEET_SHARE_MODE") || "private";

      if (!serviceAccountEmail || !privateKey || !folderId) {
        throw new Error("Missing Google configuration in environment variables");
      }

      privateKey = privateKey.replace(/\\n/g, "\n");

      const client = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
      });

      const tokenResponse = await client.getAccessToken();
      const accessToken = tokenResponse.token;

      if (!accessToken) throw new Error("Failed to get Google Access Token");

      // Fetch sale profile for sheet title
      const { data: saleProfile } = await serviceClient.from("profiles").select("display_name, email").eq("id", saleId).single();
      const saleName = saleProfile?.display_name || saleProfile?.email || saleId;
      const sheetTitle = `[${reportType.toUpperCase()}] Báo cáo Sales - ${saleName} (${periodStart} -> ${periodEnd})`;

      // 4. Create new Spreadsheet in Google Drive Folder
      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { title: sheetTitle }
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error("Failed to create spreadsheet: " + JSON.stringify(err));
      }

      const spreadsheet = await createRes.json();
      const spreadsheetId = spreadsheet.spreadsheetId;
      const sheetUrl = spreadsheet.spreadsheetUrl;

      // Move file to specified folder
      const getFileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=parents`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const fileData = await getFileRes.json();
      const previousParents = fileData.parents.join(',');

      await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${folderId}&removeParents=${previousParents}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // 5. Share Permission
      if (shareMode === "anyone_with_link") {
        await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "anyone",
            role: "reader"
          })
        });
      }

      // 6. Write Data to Sheet
      const manualInputs = reportData.manual_inputs || {};
      
      const values = [
        ["BÁO CÁO HIỆU SUẤT BÁN HÀNG"],
        [""],
        ["Nhân sự:", saleName],
        ["Loại báo cáo:", reportType === "weekly" ? "Báo cáo Tuần" : "Báo cáo Tháng"],
        ["Giai đoạn:", `${periodStart} đến ${periodEnd}`],
        [""],
        ["--- CHỈ SỐ KPI ---"],
        ["Doanh thu (VNĐ)", reportData.total_revenue || 0],
        ["Tổng đơn hàng", reportData.order_count || 0],
        ["Khách mua hàng", reportData.customers_who_ordered || 0],
        ["Khách mới", reportData.new_customers || 0],
        ["Viếng thăm trực tiếp", reportData.direct_visits || 0],
        ["Khách đang Follow", reportData.customers_followed || 0],
        ["Call / Zoom", reportData.live_zoom_sessions || 0],
        ["Doanh thu Cơ hội", reportData.opportunities_expected_revenue || 0],
        [""],
        ["--- CẬP NHẬT THỦ CÔNG ---"],
        ["Chi phí Variable (VNĐ)", manualInputs.variable_cost || 0],
        ["Dự kiến số đơn kỳ tới", manualInputs.expected_orders_next_period || 0],
        ["Ghi chú", manualInputs.notes || ""]
      ];

      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:B20?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values })
      });

      if (!writeRes.ok) {
        throw new Error("Failed to write data to sheet");
      }

      // 7. Mark Success in DB
      await serviceClient
        .from("sales_report_exports")
        .update({
          export_status: "success",
          google_sheet_id: spreadsheetId,
          google_sheet_url: sheetUrl,
        })
        .eq("id", exportId);

      return json({ success: true, url: sheetUrl });

    } catch (err: any) {
      // Mark Error in DB
      console.error(err);
      await serviceClient
        .from("sales_report_exports")
        .update({
          export_status: "error",
          error_message: err.message || "Unknown error",
        })
        .eq("id", exportId);

      return json({ success: false, error: err.message }, 500);
    }
  } catch (error: any) {
    console.error(error);
    return json({ success: false, error: error.message }, 500);
  }
});
