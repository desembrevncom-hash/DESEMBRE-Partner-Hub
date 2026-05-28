import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="desembre_backup_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16)}.json"`
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 1. Kiểm tra người gọi
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 2. Kiểm tra role
    const { data: managerRoles, error: managerRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "sub_admin"]);

    const callerRoleStrings = (managerRoles || []).map((r) => r.role);
    const isCallerManager = callerRoleStrings.includes("admin") || callerRoleStrings.includes("sub_admin");

    if (!isCallerManager) {
      return json({ error: "Yêu cầu quyền quản lý (Admin hoặc Phó Admin) để export backup" }, 403);
    }

    // 3. Truy xuất dữ liệu các bảng
    const tablesToExport = [
      "customers",
      "customer_activities",
      "customer_interactions",
      "customer_tasks",
      "orders",
      "message_templates",
      "user_communication_accounts",
      "customer_contact_channels",
      "ai_settings",
      "system_settings",
      "pilot_modules",
      "product_copilot_quick_replies"
    ];

    const tablesData: Record<string, any[]> = {};
    let totalRecordCount = 0;

    for (const table of tablesToExport) {
      // Dùng adminClient (service_role) để lấy hết data bỏ qua RLS
      const { data, error } = await adminClient.from(table).select("*");
      if (error) {
        console.error(`Error exporting table ${table}:`, error);
        // Có thể table không tồn tại, cứ gán rỗng thay vì crash toàn bộ
        tablesData[table] = [];
      } else {
        tablesData[table] = data || [];
        totalRecordCount += (data || []).length;
      }
    }

    // 4. Audit Log
    await adminClient.from("app_logs").insert({
      action: "backup_exported",
      user_id: user.id,
      details: { table_count: tablesToExport.length, total_records: totalRecordCount },
    });

    // 5. Build JSON
    const backupJson = {
      version: "v0.9.0-pre-pilot",
      created_at: new Date().toISOString(),
      tables: tablesData
    };

    return json(backupJson);
  } catch (error) {
    console.error("Backup export failed:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});
