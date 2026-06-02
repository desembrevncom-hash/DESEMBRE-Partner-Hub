import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "missing_config" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── 1. Auth check ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const authResult = await supabaseClient.auth.getUser();
    const user = authResult.data?.user;
    const authError = authResult.error;

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'sub_admin'])
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admins only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use admin client for DB queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ─── 2. ENV variables ───────────────────────────────────────────────────────
    const resendWorkerEnabled = Deno.env.get("RESEND_WEBHOOK_WORKER_ENABLED") === "true";
    const zaloWorkerEnabled = Deno.env.get("ZALO_WEBHOOK_WORKER_ENABLED") === "true";
    const prodSendingEnabled = Deno.env.get("MARKETING_PRODUCTION_SENDING_ENABLED") === "true";
    const providerMode = Deno.env.get("MARKETING_PROVIDER_MODE") || "unknown";
    const resendWorkerCronSecretPresent = Deno.env.get("RESEND_WEBHOOK_WORKER_CRON_SECRET") !== undefined && Deno.env.get("RESEND_WEBHOOK_WORKER_CRON_SECRET") !== "";
    const zaloWorkerCronSecretPresent = Deno.env.get("ZALO_WEBHOOK_WORKER_CRON_SECRET") !== undefined && Deno.env.get("ZALO_WEBHOOK_WORKER_CRON_SECRET") !== "";
    const zaloWorkerEnabledPresent = Deno.env.get("ZALO_WEBHOOK_WORKER_ENABLED") !== undefined && Deno.env.get("ZALO_WEBHOOK_WORKER_ENABLED") !== "";

    // ─── 3. DB Queries ──────────────────────────────────────────────────────────
    
    // Webhook Events
    const { count: pendingResendCount } = await adminClient
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .eq("provider", "resend")
      .eq("status", "received");

    // Zalo Pending Delivery Events
    const { count: pendingZaloDeliveryCount } = await adminClient
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .in("provider", ["zalo", "zalo_zbs"])
      .eq("signature_valid", true)
      .eq("status", "received")
      .in("event_type", ["user_received_message", "zns_delivered", "zns_failed", "user_seen_message"]);

    // Zalo Inbound Events (received non-delivery Zalo events)
    const { count: inboundZaloCount } = await adminClient
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .in("provider", ["zalo", "zalo_zbs"])
      .eq("signature_valid", true)
      .eq("status", "received")
      .not("event_type", "in", '("user_received_message","zns_delivered","zns_failed","user_seen_message")');

    const { count: failedWebhookCount } = await adminClient
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed");

    const { data: latestWebhook } = await adminClient
      .from("webhook_events")
      .select("received_at")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Suppression List
    const { count: activeEmailSuppressions } = await adminClient
      .from("marketing_suppression_list")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("is_active", true);

    // Delivery Logs
    const { data: lastDeliveryLog } = await adminClient
      .from("marketing_delivery_logs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Sender Accounts
    const { count: healthySenderCount } = await adminClient
      .from("sender_accounts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
      
    const { count: errorSenderCount } = await adminClient
      .from("sender_accounts")
      .select("*", { count: "exact", head: true })
      .neq("status", "active");

    // ─── 4. Response Construction ───────────────────────────────────────────────
    const response = {
      success: true,
      status: {
        resend_worker_enabled: resendWorkerEnabled,
        zalo_worker_enabled: zaloWorkerEnabled,
        marketing_production_sending_enabled: prodSendingEnabled,
        marketing_provider_mode: providerMode,
        zalo_production_status: "locked",
        cron_scheduler_status: "manual_verified",
        resend_worker_cron_secret_present: resendWorkerCronSecretPresent,
        zalo_worker_cron_secret_present: zaloWorkerCronSecretPresent,
        zalo_worker_enabled_present: zaloWorkerEnabledPresent
      },
      counts: {
        pending_resend_events: pendingResendCount || 0,
        pending_zalo_delivery_events: pendingZaloDeliveryCount || 0,
        inbound_zalo_events: inboundZaloCount || 0,
        failed_webhook_events: failedWebhookCount || 0,
        active_email_suppressions: activeEmailSuppressions || 0,
        healthy_sender_count: healthySenderCount || 0,
        error_sender_count: errorSenderCount || 0
      },
      timestamps: {
        latest_webhook_received_at: latestWebhook?.received_at || null,
        last_delivery_log_at: lastDeliveryLog?.created_at || null
      },
      message: "Read-only operations status. No secrets returned."
    };

    return new Response(JSON.stringify(response), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
