import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ─── Verify JWT & Role ──────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify admin/subadmin role
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "sub_admin"])
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden: Admin or SubAdmin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── Parse payload ──────────────────────────────────────────────────────────
  try {
    const {
      provider,
      channel,
      name,
      sender_email,
      sender_name,
      auth_type,
      status,
      health_status,
      last_error,
      domain,
      secret_prefix,
      provider_secret,
    } = await req.json();

    if (!provider || !name) {
      return new Response(JSON.stringify({ error: "provider and name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert new sender account
    const { data: inserted, error: insertError } = await supabase
      .from("sender_accounts")
      .insert([
        {
          provider,
          channel: channel || "email",
          name,
          sender_email: sender_email || null,
          sender_name: sender_name || null,
          auth_type: auth_type || "api_key",
          status: status || "pending_verification",
          health_status: health_status || "unknown",
          last_error: last_error || null,
          daily_limit: 500,
          daily_usage: 0,
          domain: domain || null,
          secret_prefix: secret_prefix || "GOOGLE_DEFAULT",
          provider_secret: provider_secret || null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log action to sender_action_logs
    await supabase.from("sender_action_logs").insert({
      action: "create_sender",
      sender_id: inserted.id,
      sender_type: "business",
      performed_by: user.id,
      result: health_status || "ok",
      note: `Created sender account: ${name} (${provider})`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: inserted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
