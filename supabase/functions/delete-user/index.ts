import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const {
      data: { user: currentUser },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !currentUser) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Tối ưu hóa: Lấy danh sách các vai trò quản lý của người gọi
    const { data: callerRoles, error: callerRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .in("role", ["admin", "sub_admin"]);

    const isPrimaryAdmin = currentUser.email === "desembrevn.com@gmail.com";

    if (callerRoleError) {
      return json({ error: `Không kiểm tra được quyền quản trị: ${callerRoleError.message}` }, 400);
    }

    const callerRoleStrings = (callerRoles || []).map((r) => r.role);
    const isCallerAdmin = isPrimaryAdmin || callerRoleStrings.includes("admin");
    const isCallerSubAdmin = callerRoleStrings.includes("sub_admin");

    if (!isCallerAdmin && !isCallerSubAdmin) {
      return json({ error: "Manager access required" }, 403);
    }

    const body = await req.json();
    const userId = String(body.userId || "").trim();

    if (!userId) {
      return json({ error: "Missing userId" }, 400);
    }

    if (userId === currentUser.id) {
      return json({ error: "Không thể xoá chính tài khoản đang đăng nhập" }, 400);
    }

    // Tầng 2 logic: Kiểm tra vai trò của đối tượng bị xóa để thực thi rào chắn bảo mật cấp hệ thống
    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const targetRoleStrings = (targetRoles || []).map((r) => r.role);

    if (targetRoleStrings.includes("admin")) {
      return json({ error: "Hệ thống bảo mật từ chối thao tác xóa tài khoản ADMIN gốc!" }, 403);
    }

    // Nếu người gọi chỉ là Phó Admin, tuyệt đối cấm xóa tài khoản Phó Admin ngang hàng khác
    if (!isCallerAdmin && targetRoleStrings.includes("sub_admin")) {
      return json({ error: "Phó Admin không có quyền xóa tài khoản Phó Admin ngang hàng!" }, 403);
    }

    const { data: targetUserData, error: targetUserError } =
      await adminClient.auth.admin.getUserById(userId);

    if (targetUserError || !targetUserData.user) {
      // User không còn trong Auth nhưng vẫn còn trong profiles/user_roles.
      // Dọn dữ liệu public để không còn hiện trong danh sách quản lý.
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("id", userId);

      return json({
        success: true,
        deletedUser: {
          id: userId,
          email: null,
          wasOrphanProfile: true,
        },
      });
    }

    if (targetUserData.user.email === "desembrevn.com@gmail.com") {
      return json({ error: "Không thể xoá tài khoản admin gốc" }, 400);
    }

    const { data: existingOrders, error: ordersErr } = await adminClient
      .from("orders")
      .select("id")
      .eq("sale_user_id", userId)
      .limit(1);

    if (!ordersErr && existingOrders && existingOrders.length > 0) {
      return json(
        {
          error:
            "Tài khoản này đã tạo đơn hàng trong hệ thống. Để bảo toàn dữ liệu đối soát, vui lòng không xóa mà hãy gỡ quyền SALE của nhân viên này.",
        },
        400,
      );
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      return json({ error: `Không xoá được Auth user: ${deleteError.message}` }, 400);
    }

    // Explicitly guarantee complete cascading sweep of metadata entries
    await adminClient.from("profiles").delete().eq("id", userId);
    await adminClient.from("user_roles").delete().eq("user_id", userId);

    return json({
      success: true,
      deletedUser: {
        id: userId,
        email: targetUserData.user.email,
      },
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
