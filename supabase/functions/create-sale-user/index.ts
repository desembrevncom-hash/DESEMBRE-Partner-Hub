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

    const adminClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: adminRole, error: roleCheckError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isPrimaryAdmin = user.email === "desembrevn.com@gmail.com";

    if (roleCheckError) {
      return json({ error: `Role check failed: ${roleCheckError.message}` }, 400);
    }

    if (!isPrimaryAdmin && !adminRole) {
      return json({ error: "Admin only" }, 403);
    }

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();

    if (!email) {
      return json({ error: "Email is required" }, 400);
    }

    if (!fullName) {
      return json({ error: "Full name is required" }, 400);
    }

    const { data: createdUser, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email,
        password: DEFAULT_SALE_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: fullName,
          full_name: fullName,
        },
      });

    if (createUserError || !createdUser.user) {
      return json(
        {
          error: createUserError?.message || "Cannot create user",
        },
        400
      );
    }

    const newUserId = createdUser.user.id;

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          email,
          display_name: fullName,
          must_change_password: true,
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      await adminClient.auth.admin.deleteUser(newUserId);

      return json(
        {
          error: `Không tạo được profile: ${profileError.message}`,
        },
        400
      );
    }

    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert(
        {
          user_id: newUserId,
          role: "sale",
        },
        {
          onConflict: "user_id,role",
        }
      );

    if (roleError) {
      await adminClient.auth.admin.deleteUser(newUserId);

      return json(
        {
          error: `Không gán được role SALE: ${roleError.message}`,
        },
        400
      );
    }

    return json({
      success: true,
      user: {
        id: newUserId,
        email,
        displayName: fullName,
        role: "sale",
        defaultPassword: DEFAULT_SALE_PASSWORD,
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
