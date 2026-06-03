import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_SALE_PASSWORD = "12345678";

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
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Tối ưu hóa: Lấy danh sách các vai trò quản lý của người gọi
    const { data: managerRoles, error: managerRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "sub_admin"]);

    const callerRoleStrings = (managerRoles || []).map((r) => r.role);
    const isCallerAdmin = callerRoleStrings.includes("admin");
    const isCallerSubAdmin = callerRoleStrings.includes("sub_admin");

    if (!isCallerAdmin && !isCallerSubAdmin) {
      return json({ error: "Manager access required" }, 403);
    }

    const body = await req.json();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const requestedRole = String(body.role || "sale")
      .trim()
      .toLowerCase();

    if (!email) {
      return json({ error: "Email is required" }, 400);
    }

    if (!fullName) {
      return json({ error: "Tên hiển thị là bắt buộc" }, 400);
    }

    // Tầng 2 logic: Phân giải các vai trò hợp lệ. Chỉ Admin được phép tạo thêm Sub-Admin.
    // Các quyền Staff (sale, tele_lead, telesale) mở cho cả Admin và Sub-Admin.
    let finalRole = "sale";
    if (["sale", "tele_lead", "telesale"].includes(requestedRole)) {
      finalRole = requestedRole;
    } else if (requestedRole === "sub_admin" && isCallerAdmin) {
      finalRole = "sub_admin";
    }

    let newUserId = "";
    let isSelfHealed = false;

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password: DEFAULT_SALE_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: fullName,
        full_name: fullName,
      },
    });

    if (createUserError || !createdUser?.user) {
      const errMsg = (createUserError?.message || "").toLowerCase();
      // Cơ chế tự phục hồi (Self-Healing): Nếu email đã tồn tại do lỗi mồ côi từ các phiên trước, tự động tra cứu ID và khôi phục
      if (errMsg.includes("already been registered") || errMsg.includes("already exists")) {
        const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers();
        if (!listErr && listData?.users) {
          const target = listData.users.find((u) => u.email?.toLowerCase() === email);
          if (target) {
            newUserId = target.id;
            isSelfHealed = true;
          }
        }
      }

      if (!newUserId) {
        return json(
          {
            error: createUserError?.message || "Cannot create user",
          },
          400,
        );
      }
    } else {
      newUserId = createdUser.user.id;
    }

    // Upsert khôi phục/tạo mới hồ sơ Profile
    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: newUserId,
        email,
        display_name: fullName || email.split("@")[0],
        must_change_password: true,
      },
      {
        onConflict: "id",
      },
    );

    if (profileError) {
      // Chỉ xóa user nếu đây là user mới tạo, tránh xóa nhầm user cũ nếu tự phục hồi thất bại
      if (!isSelfHealed) {
        await adminClient.auth.admin.deleteUser(newUserId);
      }

      return json(
        {
          error: `Tạo/Khôi phục Auth user thành công nhưng ghi profiles thất bại: ${profileError.message}`,
        },
        400,
      );
    }

    // Upsert khôi phục/tạo mới Phân quyền
    const { error: roleError } = await adminClient.from("user_roles").upsert(
      {
        user_id: newUserId,
        role: finalRole,
      },
      {
        onConflict: "user_id,role",
      },
    );

    if (roleError) {
      if (!isSelfHealed) {
        await adminClient.auth.admin.deleteUser(newUserId);
      }

      return json(
        {
          error: `Tạo/Khôi phục Auth user thành công nhưng gán role thất bại: ${roleError.message}`,
        },
        400,
      );
    }

    // Gỡ các quyền dư thừa nếu đây là tài khoản được khôi phục sang vai trò mới
    if (isSelfHealed) {
      const otherRoles = ["admin", "sub_admin", "sale", "tele_lead", "telesale"].filter(
        (r) => r !== finalRole,
      );
      for (const or of otherRoles) {
        await adminClient.from("user_roles").delete().eq("user_id", newUserId).eq("role", or);
      }
    }

    return json({
      success: true,
      user: {
        id: newUserId,
        email,
        displayName: fullName,
        role: finalRole,
        defaultPassword: DEFAULT_SALE_PASSWORD,
        recoveredOrphan: isSelfHealed,
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
