import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_PASSWORD = "12345678";

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

    // 1. Kiểm tra người gọi đăng nhập
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 2. Kiểm tra người gọi có role admin hoặc sub_admin
    const { data: managerRoles, error: managerRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "sub_admin"]);

    const isPrimaryAdmin = user.email === "desembrevn.com@gmail.com";

    if (managerRoleError) {
      return json(
        { error: `Không kiểm tra được quyền quản trị: ${managerRoleError.message}` },
        400
      );
    }

    const callerRoleStrings = (managerRoles || []).map((r) => r.role);
    const isCallerManager = isPrimaryAdmin || callerRoleStrings.includes("admin") || callerRoleStrings.includes("sub_admin");

    if (!isCallerManager) {
      return json({ error: "Yêu cầu quyền quản lý (Admin hoặc Phó Admin)" }, 403);
    }

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const requestedRole = String(body.role || "sale").trim().toLowerCase();

    if (!email || !fullName) {
      return json({ error: "Email và Tên hiển thị là bắt buộc" }, 400);
    }

    // 3. Validate role chỉ được là sale, tele_lead, telesale
    // 4. Không cho tạo admin/sub_admin từ function này
    if (!["sale", "tele_lead", "telesale"].includes(requestedRole)) {
      return json({ error: "Vai trò không hợp lệ. Chỉ hỗ trợ tạo staff: sale, tele_lead, telesale." }, 400);
    }

    const finalRole = requestedRole;

    let newUserId = "";
    let isSelfHealed = false;

    // 5. Tạo Supabase Auth user bằng service_role
    // 6. password mặc định = 12345678.
    // 7. email_confirm = true.
    const { data: createdUser, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: fullName,
          full_name: fullName,
        },
      });

    if (createUserError || !createdUser?.user) {
      const errMsg = (createUserError?.message || "").toLowerCase();
      // Cơ chế tự phục hồi: Nếu email đã tồn tại do lỗi mồ côi từ trước, tự động tra cứu ID và khôi phục
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
            error: createUserError?.message || "Không thể tạo tài khoản xác thực",
          },
          400
        );
      }
    } else {
      newUserId = createdUser.user.id;
    }

    // 8. Upsert profiles: id, email, display_name, must_change_password = true
    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: newUserId,
        email,
        display_name: fullName || email.split("@")[0],
        must_change_password: true,
      },
      {
        onConflict: "id",
      }
    );

    if (profileError) {
      // 10. Nếu profile fail thì rollback xóa auth user vừa tạo
      if (!isSelfHealed) {
        await adminClient.auth.admin.deleteUser(newUserId);
      }
      return json(
        {
          error: `Tạo Auth user thành công nhưng ghi profiles thất bại: ${profileError.message}`,
        },
        400
      );
    }

    // 9. Insert/upsert user_roles: user_id, role
    const { error: roleError } = await adminClient.from("user_roles").upsert(
      {
        user_id: newUserId,
        role: finalRole,
      },
      {
        onConflict: "user_id,role",
      }
    );

    if (roleError) {
      // 10. Nếu role fail thì rollback xóa auth user vừa tạo
      if (!isSelfHealed) {
        await adminClient.auth.admin.deleteUser(newUserId);
      }
      return json(
        {
          error: `Tạo Auth user thành công nhưng gán role thất bại: ${roleError.message}`,
        },
        400
      );
    }

    // Gỡ các quyền dư thừa nếu đây là tài khoản được khôi phục sang vai trò mới
    if (isSelfHealed) {
      const otherRoles = ["admin", "sub_admin", "sale", "tele_lead", "telesale"].filter((r) => r !== finalRole);
      for (const or of otherRoles) {
        await adminClient.from("user_roles").delete().eq("user_id", newUserId).eq("role", or);
      }
    }

    // 11. Trả JSON success rõ
    return json({
      success: true,
      user: {
        id: newUserId,
        email,
        displayName: fullName,
        role: finalRole,
        defaultPassword: DEFAULT_PASSWORD,
        recoveredOrphan: isSelfHealed,
      },
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});
