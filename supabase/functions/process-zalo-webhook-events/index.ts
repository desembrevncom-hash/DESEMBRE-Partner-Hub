import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret",
};

const LOCK_KEY = "process_zalo_webhook_events";
const LOCK_TTL_SECONDS = 120; // 2-minute TTL

// Priority values for delivery logs status
const DELIVERY_STATUS_PRIORITY: Record<string, number> = {
  "failed": 4,
  "opened": 3,
  "delivered": 2,
  "sent": 1,
  "test_sent": 1,
  "prepared": 1,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("ZALO_WEBHOOK_WORKER_CRON_SECRET");
    const isWorkerEnabled = Deno.env.get("ZALO_WEBHOOK_WORKER_ENABLED") === "true";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "missing_config", details: "Env vars missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 1. Auth Gate & Kill Switch ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const xWorkerSecret = req.headers.get("X-Worker-Secret");

    let isCronAuth = false;

    if (xWorkerSecret) {
      // Path 1: Cron Secret Auth
      if (!cronSecret || xWorkerSecret !== cronSecret) {
        return new Response(
          JSON.stringify({ error: "Unauthorized (invalid worker secret)" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      isCronAuth = true;

      // Kill switch check for cron
      if (!isWorkerEnabled) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "worker_disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (authHeader) {
      // Path 2: JWT Admin/Sub-admin Auth (from UI manual run)
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const authResult = await supabaseClient.auth.getUser();
      const user = authResult.data?.user;
      const authError = authResult.error;

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", details: authError?.message || "Invalid token." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: roleData, error: roleError } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "sub_admin"])
        .maybeSingle();

      if (roleError || !roleData) {
        return new Response(
          JSON.stringify({ error: "Forbidden", details: "Admins/Sub-admins only." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // No auth headers provided
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Missing credentials." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 2. Service role admin client ──────────────────────────────────────────
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body and confirm parameter
    let dryRun = true;
    try {
      const body = await req.json();
      if (body?.confirm === "PROCESS_ZALO_WEBHOOKS") {
        dryRun = false;
      }
    } catch {
      dryRun = true; // Default to dry-run if body parsing fails
    }

    // ─── 3. Concurrency Lock ───────────────────────────────────────────────────
    const { data: lockAcquired, error: lockError } = await supabaseAdmin.rpc(
      "acquire_execution_lock",
      { p_lock_key: LOCK_KEY, p_ttl_seconds: LOCK_TTL_SECONDS }
    );

    if (lockError) {
      return new Response(
        JSON.stringify({
          success: false,
          step: "lock",
          error: "lock_rpc_error",
          details: lockError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lockAcquired) {
      return new Response(
        JSON.stringify({
          success: false,
          step: "lock",
          error: "already_running",
          message: "Worker is already running. Concurrent execution blocked.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any;
    try {
      // ─── 4. Query events ─────────────────────────────────────────────────────
      const { data: events, error: fetchError } = await supabaseAdmin
        .from("webhook_events")
        .select("id, provider, event_type, channel, related_message_id, received_at, payload")
        .in("provider", ["zalo", "zalo_zbs"])
        .eq("signature_valid", true)
        .eq("status", "received")
        .order("received_at", { ascending: true })
        .limit(50);

      if (fetchError) throw fetchError;

      let scanned = 0;
      let would_update_delivery_logs = 0;
      let updated_delivery_logs = 0;
      let processed_count = 0;
      let skipped_non_delivery = 0;
      let failed_count = 0;
      let delivery_log_found = 0;
      let delivery_log_not_found = 0;
      let missing_related_message_id = 0;

      const processed_event_ids: string[] = [];
      const skipped_event_ids: string[] = [];
      const failed_event_ids: string[] = [];
      const preview_items: any[] = [];

      const DELIVERY_EVENTS = new Set([
        "user_received_message",
        "zns_delivered",
        "zns_failed",
        "user_seen_message",
      ]);

      const NON_DELIVERY_EVENTS = new Set([
        "user_send_text",
        "user_send_image",
        "user_send_location",
        "follow",
        "unfollow",
        "oa_send_text",
        "change_template_status",
      ]);

      for (const event of events || []) {
        scanned++;
        const payload: any = event.payload || {};
        const related_message_id = event.related_message_id || "";
        const event_type = event.event_type || "";

        let classification: "delivery_update" | "skipped_non_delivery" | "unknown" = "unknown";
        let would_status: string | null = null;

        // Classification
        if (DELIVERY_EVENTS.has(event_type)) {
          classification = "delivery_update";
          if (event_type === "user_received_message" || event_type === "zns_delivered") {
            would_status = "delivered";
          } else if (event_type === "zns_failed") {
            would_status = "failed";
          } else if (event_type === "user_seen_message") {
            would_status = "opened";
          }
        } else if (NON_DELIVERY_EVENTS.has(event_type) || event_type === "") {
          classification = "skipped_non_delivery";
        } else {
          classification = "unknown";
        }

        // Skipped non-delivery & unknown events (strictly no DB writes, remain 'received')
        if (classification === "skipped_non_delivery" || classification === "unknown") {
          skipped_non_delivery++;
          skipped_event_ids.push(event.id);

          preview_items.push({
            webhook_event_id: event.id,
            provider: event.provider,
            channel: event.channel,
            event_type: event_type,
            related_message_id: related_message_id,
            classification,
            would_status: null,
            can_map_delivery_log: false,
            matching_delivery_log_id: null,
            current_delivery_status: null,
            would_overwrite: false,
            mapping_note: "non_delivery_event_skipped",
          });
          continue;
        }

        // Processing for Delivery Update
        let can_map_delivery_log = false;
        let matching_delivery_log_id: string | null = null;
        let current_delivery_status: string | null = null;
        let would_overwrite = false;
        let mapping_note = "";
        let final_webhook_status: "processed" | "failed" = "processed";
        let error_message = "";

        if (!related_message_id) {
          missing_related_message_id++;
          final_webhook_status = "failed";
          error_message = "missing_related_message_id";
          mapping_note = "missing_related_message_id";
        } else {
          // Mapping check
          const { data: dLog, error: dLogError } = await supabaseAdmin
            .from("marketing_delivery_logs")
            .select("id, status")
            .eq("provider_message_id", related_message_id)
            .maybeSingle();

          if (dLogError) {
            final_webhook_status = "failed";
            error_message = `error_fetching_log: ${dLogError.message}`;
            mapping_note = `error_fetching_log: ${dLogError.message}`;
          } else if (!dLog) {
            delivery_log_not_found++;
            final_webhook_status = "failed";
            error_message = "delivery_log_not_found";
            mapping_note = "delivery_log_not_found";
          } else {
            delivery_log_found++;
            can_map_delivery_log = true;
            matching_delivery_log_id = dLog.id;
            current_delivery_status = dLog.status;
            mapping_note = "delivery_log_found";

            // Check priority overwrite
            const currentPriority = DELIVERY_STATUS_PRIORITY[current_delivery_status] || 0;
            const newPriority = would_status ? (DELIVERY_STATUS_PRIORITY[would_status] || 0) : 0;

            if (current_delivery_status === "failed") {
              would_overwrite = false; // permanent failure cannot be overwritten by delivery/open
            } else if (current_delivery_status === "opened" && would_status === "delivered") {
              would_overwrite = false; // open cannot be downgraded to delivered
            } else if (newPriority > currentPriority) {
              would_overwrite = true;
            } else if (would_status === "failed") {
              would_overwrite = true; // failed can override anything (except if it was already failed)
            }

            if (would_overwrite) {
              would_update_delivery_logs++;
            } else {
              mapping_note = "no_status_upgrade_needed";
            }
          }
        }

        // Database writes in Confirm Mode only
        if (!dryRun) {
          if (can_map_delivery_log && would_overwrite && matching_delivery_log_id && would_status) {
            // Update Delivery Log status
            const { error: dLogUpdateError } = await supabaseAdmin
              .from("marketing_delivery_logs")
              .update({
                status: would_status,
                reason: would_status,
              })
              .eq("id", matching_delivery_log_id);

            if (!dLogUpdateError) {
              updated_delivery_logs++;
            } else {
              console.error(`Error updating delivery log ${matching_delivery_log_id}:`, dLogUpdateError.message);
            }
          }

          // Update Webhook Event Status
          const webhookUpdatePayload: Record<string, any> = {
            status: final_webhook_status,
            processed_at: new Date().toISOString(),
          };
          if (final_webhook_status === "failed") {
            webhookUpdatePayload.error_message = error_message;
          }

          const { error: webhookUpdateError } = await supabaseAdmin
            .from("webhook_events")
            .update(webhookUpdatePayload)
            .eq("id", event.id);

          if (!webhookUpdateError) {
            if (final_webhook_status === "processed") {
              processed_count++;
              processed_event_ids.push(event.id);
            } else {
              failed_count++;
              failed_event_ids.push(event.id);
            }
          } else {
            console.error(`Error updating webhook event ${event.id}:`, webhookUpdateError.message);
          }
        } else {
          // In dry-run, we just collect would-be statuses
          if (final_webhook_status === "processed") {
            processed_count++;
            processed_event_ids.push(event.id);
          } else {
            failed_count++;
            failed_event_ids.push(event.id);
          }
        }

        preview_items.push({
          webhook_event_id: event.id,
          provider: event.provider,
          channel: event.channel,
          event_type: event_type,
          related_message_id: related_message_id,
          classification,
          would_status,
          can_map_delivery_log,
          matching_delivery_log_id,
          current_delivery_status,
          would_overwrite,
          mapping_note,
        });
      }

      result = {
        success: true,
        dry_run: dryRun,
        lock_acquired: true,
        scanned,
        would_update_delivery_logs,
        updated_delivery_logs,
        processed: processed_count,
        skipped_non_delivery,
        failed: failed_count,
        delivery_log_found,
        delivery_log_not_found,
        missing_related_message_id,
        processed_event_ids,
        skipped_event_ids,
        failed_event_ids,
        preview_items,
      };
    } finally {
      // ─── 5. Always release lock, even on error ───────────────────────────────
      await supabaseAdmin.rpc("release_execution_lock", { p_lock_key: LOCK_KEY });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
