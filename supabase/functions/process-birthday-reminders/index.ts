import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("BIRTHDAY_REMINDER_WORKER_CRON_SECRET");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "missing_config", details: "Env vars missing on Edge Function." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    const xWorkerSecret = req.headers.get("X-Worker-Secret");

    let isCronAuth = false;
    let isBypassKillSwitch = false;

    // ─── 1. Authentication Check ───────────────────────────────────────────────
    if (xWorkerSecret) {
      // Path A: Cron Secret Path
      if (!cronSecret || xWorkerSecret !== cronSecret) {
        return new Response(
          JSON.stringify({ error: "Unauthorized (invalid worker secret)" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      isCronAuth = true;
    } else if (authHeader) {
      // Path B: JWT User Validation (Admin/Sub-admin bypass)
      const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await clientSupabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", details: authError?.message || "Invalid JWT." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check user roles
      const { data: roleData, error: roleError } = await clientSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "sub_admin"])
        .maybeSingle();

      if (roleError || !roleData) {
        return new Response(
          JSON.stringify({ error: "Forbidden", details: "Admins/Sub-admins role required." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Bypass kill-switch checks since it is a manual admin request
      isBypassKillSwitch = true;
    } else {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Credentials required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 2. Service Role Admin Connection ──────────────────────────────────────
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ─── 3. Parse Body & Parameters ──────────────────────────────────────────
    let dryRun = true;
    try {
      const body = await req.json();
      if (body?.confirm === "PROCESS_BIRTHDAY_REMINDERS") {
        dryRun = false;
      }
    } catch {
      dryRun = true; // Default to dry-run preview
    }

    // Read Dynamic Kill Switch from system_settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("system_settings")
      .select("birthday_reminder_worker_enabled")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "db_error", details: "Failed to read system_settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isWorkerEnabled = settings.birthday_reminder_worker_enabled === true;

    // ─── 4. Check Kill Switch & Admin Bypass Rules ─────────────────────────────
    // Admin is allowed to bypass the kill switch ONLY for dry-run previews.
    // If kill switch is false, confirm mode is strictly blocked for both Admin and Cron paths.
    if (!isWorkerEnabled) {
      const isAdminDryRun = isBypassKillSwitch && dryRun;
      if (!isAdminDryRun) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "worker_disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── 5. Invoke generate_birthday_reminders RPC ─────────────────────────────
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("generate_birthday_reminders", {
      p_dry_run: dryRun,
      p_confirm_phrase: dryRun ? "" : "PROCESS_BIRTHDAY_REMINDERS"
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ success: false, error: "rpc_error", details: "RPC execution failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 6. Format Response (PII-Safe check) ───────────────────────────────────
    if (isCronAuth) {
      // Cron path: summary response only (no PII, no contact names, no customer IDs)
      return new Response(
        JSON.stringify({
          success: true,
          skipped: false,
          reason: "executed",
          dry_run: dryRun,
          worker_enabled: isWorkerEnabled,
          scanned_count: rpcData?.processed_reminders_count || 0,
          created_tasks_count: rpcData?.created_tasks_count || 0,
          processed_reminders_count: rpcData?.processed_reminders_count || 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Admin path: full response with logs for manual previews
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: dryRun,
          worker_enabled: isWorkerEnabled,
          bypass_kill_switch: isBypassKillSwitch,
          rpc_result: rpcData
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", details: "Internal server error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
