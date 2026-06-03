import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { refreshZaloToken } from "../_shared/zalo-token-refresh.ts";

// ── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // ── Auth: Admin/SubAdmin hoặc internal service call ─────────────────────────
  const authHeader = req.headers.get("Authorization");
  const internalKey = req.headers.get("X-Internal-Key");
  const expectedInternalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") || "";

  let callerUserId: string | null = null;
  let isInternalCall = false;

  if (internalKey && expectedInternalKey && internalKey === expectedInternalKey) {
    // Gọi nội bộ từ cron/edge function khác
    isInternalCall = true;
  } else if (authHeader) {
    const {
      data: { user },
      error: authErr,
    } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "sub_admin"])
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin or SubAdmin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    callerUserId = user.id;
  } else {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { sender_account_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { sender_account_id } = body;
  if (!sender_account_id) {
    return new Response(JSON.stringify({ error: "sender_account_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    await refreshZaloToken(adminClient, sender_account_id);

    // Get updated token expiry
    const { data: updatedToken } = await adminClient
      .from("sender_account_tokens")
      .select("token_expires_at")
      .eq("sender_account_id", sender_account_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        health_status: "healthy",
        token_expires_at: updatedToken?.token_expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    const msg = err.message || "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
