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

    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    const isPrimaryAdmin = currentUser.email === "desembrevn.com@gmail.com";

    if (adminRoleError) {
      return json(
        { error: `Không kiểm tra được quyền admin: ${adminRoleError.message}` },
        400
      );
    }

    if (!isPrimaryAdmin && !adminRole) {
      return json({ error: "Admin only" }, 403);
    }

    const body = await req.json();
    const userId = String(body.userId || "").trim();

    if (!userId) {
      return json({ error: "Missing userId" }, 400);
    }

    if (userId === currentUser.id) {
      return json({ error: "Không thể xoá chính tài khoản đang đăng nhập" }, 400);
    }

    const { data: targetUserData, error: targetUserError } =
      await adminClient.auth.admin.getUserById(userId);

    if (targetUserError || !targetUserData.user) {
      return json({ error: "Không tìm thấy user trong Supabase Auth" }, 404);
    }

    if (targetUserData.user.email === "desembrevn.com@gmail.com") {
      return json({ error: "Không thể xoá tài khoản admin gốc" }, 400);
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      return json(
        { error: `Không xoá được Auth user: ${deleteError.message}` },
        400
      );
    }

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
      500
    );
  }
});
