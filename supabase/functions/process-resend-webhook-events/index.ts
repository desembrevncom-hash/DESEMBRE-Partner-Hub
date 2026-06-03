import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-secret",
};

const LOCK_KEY = "process_resend_webhook_events";
const LOCK_TTL_SECONDS = 120; // 2-minute TTL

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("RESEND_WEBHOOK_WORKER_CRON_SECRET");
    const isWorkerEnabled = Deno.env.get("RESEND_WEBHOOK_WORKER_ENABLED") === "true";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "missing_config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 1. Auth check ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const xWorkerSecret = req.headers.get("X-Worker-Secret");

    let isCronAuth = false;

    if (xWorkerSecret) {
      // Path 1: Cron Secret Auth
      if (!cronSecret || xWorkerSecret !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized (invalid worker secret)" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isCronAuth = true;

      // Kill switch check for cron
      if (!isWorkerEnabled) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "worker_disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else if (authHeader) {
      // Path 2: JWT Admin/Sub-admin Auth (from UI)
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      // UI is allowed to bypass the kill switch, or we can enforce it. User said:
      // "Admin manual UI vẫn có thể chạy theo JWT Admin nếu bạn thấy phù hợp, hoặc cũng tôn trọng kill switch nếu muốn an toàn hơn. Báo rõ lựa chọn."
      // Let's allow UI manual runs even if cron is disabled. This helps testing and recovery!

      const authResult = await supabaseClient.auth.getUser();
      const user = authResult.data?.user;
      const authError = authResult.error;

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", details: authError?.message }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "sub_admin"])
        .single();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden: Admins only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // No auth headers provided
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reqBody = await req.json().catch(() => ({}));
    const isDryRun = reqBody.confirm !== "PROCESS_RESEND_WEBHOOKS";

    // ─── 2. Service-role admin client for all DB writes ─────────────────────────
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ─── 3. Acquire execution lock (reuse existing acquire_execution_lock RPC) ──
    const { data: lockAcquired, error: lockError } = await supabaseAdmin.rpc(
      "acquire_execution_lock",
      { p_lock_key: LOCK_KEY, p_ttl_seconds: LOCK_TTL_SECONDS },
    );

    if (lockError) {
      // Lock RPC itself failed — still safe to abort
      return new Response(
        JSON.stringify({
          success: false,
          step: "lock",
          error: "lock_rpc_error",
          details: lockError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!lockAcquired) {
      // Another instance is already running
      return new Response(
        JSON.stringify({
          success: false,
          step: "lock",
          error: "already_running",
          message: "Worker is already running. Concurrent execution blocked.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 4. All processing in try/finally to guarantee lock release ──────────
    let result: any;
    try {
      const targetEventTypes = [
        "email.delivered",
        "email.opened",
        "email.clicked",
        "email.bounced",
        "email.complained",
        "email.failed",
      ];

      const { data: events, error: fetchError } = await supabaseAdmin
        .from("webhook_events")
        .select("*")
        .eq("provider", "resend")
        .eq("signature_valid", true)
        .eq("status", "received")
        .in("event_type", targetEventTypes)
        .order("received_at", { ascending: true })
        .limit(50);

      if (fetchError) throw fetchError;

      let would_suppress = 0;
      let suppressed = 0;
      let ignored = 0;
      let failed = 0;
      let already_suppressed = 0;

      let would_update_delivery_logs = 0;
      let updated_delivery_logs = 0;
      let delivery_log_not_found = 0;
      let would_ignore = 0;
      let would_fail = 0;

      const processed_event_ids: string[] = [];
      const ignored_event_ids: string[] = [];
      const failed_event_ids: string[] = [];

      const reasonPriority: Record<string, number> = {
        manual_block: 4,
        complaint: 3,
        bounced: 2,
        provider_failed_permanent: 1,
      };

      const deliveryPriority: Record<string, number> = {
        failed: 4,
        clicked: 3,
        opened: 2,
        delivered: 1,
        sent: 0,
        prepared: 0,
        test_sent: 0,
      };

      for (const event of events || []) {
        try {
          const payload: any = event.payload || {};
          let email =
            payload?.data?.to?.[0] || payload?.data?.email_address || payload?.data?.email;
          const related_message_id = event.related_message_id;

          if (!email || typeof email !== "string") {
            if (!isDryRun) {
              await supabaseAdmin
                .from("webhook_events")
                .update({
                  status: "ignored",
                  error_message: "missing_recipient_email",
                  processed_at: new Date().toISOString(),
                })
                .eq("id", event.id);
              ignored++;
              ignored_event_ids.push(event.id);
            } else {
              would_ignore++;
            }
            continue;
          }

          email = email.trim().toLowerCase();

          let newDeliveryStatus = "";
          let newDeliveryReason = "";
          let isSuppressionEvent = false;
          let suppressionReason = "";

          if (event.event_type === "email.delivered") {
            newDeliveryStatus = "delivered";
          } else if (event.event_type === "email.opened") {
            newDeliveryStatus = "opened";
          } else if (event.event_type === "email.clicked") {
            newDeliveryStatus = "clicked";
          } else if (event.event_type === "email.bounced") {
            newDeliveryStatus = "failed";
            newDeliveryReason = "bounced";
            isSuppressionEvent = true;
            suppressionReason = "bounced";
          } else if (event.event_type === "email.complained") {
            newDeliveryStatus = "failed";
            newDeliveryReason = "complaint";
            isSuppressionEvent = true;
            suppressionReason = "complaint";
          } else if (event.event_type === "email.failed") {
            const failureReason = payload?.data?.reason?.toLowerCase() || "";
            const type = payload?.data?.type?.toLowerCase() || "";

            if (
              type === "hard_bounce" ||
              failureReason.includes("permanent") ||
              failureReason.includes("rejected")
            ) {
              newDeliveryStatus = "failed";
              newDeliveryReason = "provider_failed_permanent";
              isSuppressionEvent = true;
              suppressionReason = "provider_failed_permanent";
            } else {
              if (!isDryRun) {
                await supabaseAdmin
                  .from("webhook_events")
                  .update({
                    status: "ignored",
                    error_message: "non_permanent_failed_event",
                    processed_at: new Date().toISOString(),
                  })
                  .eq("id", event.id);
                ignored++;
                ignored_event_ids.push(event.id);
              } else {
                would_ignore++;
              }
              continue;
            }
          } else {
            if (!isDryRun) {
              await supabaseAdmin
                .from("webhook_events")
                .update({
                  status: "ignored",
                  error_message: "unhandled_event_type",
                  processed_at: new Date().toISOString(),
                })
                .eq("id", event.id);
              ignored++;
              ignored_event_ids.push(event.id);
            } else {
              would_ignore++;
            }
            continue;
          }

          // ── Delivery log update ──────────────────────────────────────────────
          let deliveryLogHandled = false;
          let deliveryLogNotFoundFlag = false;

          if (related_message_id) {
            const { data: dLog } = await supabaseAdmin
              .from("marketing_delivery_logs")
              .select("id, status")
              .eq("provider_message_id", related_message_id)
              .maybeSingle();

            if (dLog) {
              const currentPri = deliveryPriority[dLog.status] || 0;
              const newPri = deliveryPriority[newDeliveryStatus] || 0;

              if (newPri > currentPri) {
                if (isDryRun) {
                  would_update_delivery_logs++;
                } else {
                  const updateData: any = { status: newDeliveryStatus };
                  if (newDeliveryReason) updateData.reason = newDeliveryReason;
                  await supabaseAdmin
                    .from("marketing_delivery_logs")
                    .update(updateData)
                    .eq("id", dLog.id);
                  updated_delivery_logs++;
                }
              }
              deliveryLogHandled = true;
            } else {
              deliveryLogNotFoundFlag = true;
              if (!isDryRun) delivery_log_not_found++;
            }
          } else {
            deliveryLogNotFoundFlag = true;
            if (!isDryRun) delivery_log_not_found++;
          }

          // ── Suppression update ───────────────────────────────────────────────
          let suppressionHandled = false;
          if (isSuppressionEvent) {
            if (isDryRun) {
              would_suppress++;
              suppressionHandled = true;
            } else {
              const { data: existingSuppression } = await supabaseAdmin
                .from("marketing_suppression_list")
                .select("id, reason, metadata")
                .eq("channel", "email")
                .eq("normalized_contact_value", email)
                .eq("is_active", true)
                .maybeSingle();

              if (existingSuppression) {
                const currentPriority = reasonPriority[existingSuppression.reason] || 0;
                const newPriority = reasonPriority[suppressionReason] || 0;

                if (newPriority > currentPriority) {
                  await supabaseAdmin
                    .from("marketing_suppression_list")
                    .update({
                      reason: suppressionReason,
                      source: "resend_webhook",
                      metadata: {
                        ...(existingSuppression.metadata as object),
                        webhook_event_id: event.id,
                        provider_event_id: event.provider_event_id,
                        related_message_id: event.related_message_id,
                        event_type: event.event_type,
                        updated_via_webhook_at: new Date().toISOString(),
                      },
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingSuppression.id);
                  suppressed++;
                } else {
                  already_suppressed++;
                }
              } else {
                await supabaseAdmin.from("marketing_suppression_list").insert({
                  channel: "email",
                  contact_value: email,
                  normalized_contact_value: email,
                  reason: suppressionReason,
                  source: "resend_webhook",
                  is_active: true,
                  metadata: {
                    webhook_event_id: event.id,
                    provider_event_id: event.provider_event_id,
                    related_message_id: event.related_message_id,
                    event_type: event.event_type,
                  },
                });
                suppressed++;
              }
              suppressionHandled = true;
            }
          }

          // ── Mark webhook_events ──────────────────────────────────────────────
          if (!isDryRun) {
            const isIgnored = deliveryLogNotFoundFlag && !suppressionHandled;
            const finalStatus = isIgnored ? "ignored" : "processed";
            const errorMsg = deliveryLogNotFoundFlag ? "delivery_log_not_found" : null;

            await supabaseAdmin
              .from("webhook_events")
              .update({
                status: finalStatus,
                error_message: errorMsg,
                processed_at: new Date().toISOString(),
              })
              .eq("id", event.id);

            if (finalStatus === "processed") {
              processed_event_ids.push(event.id);
            } else {
              ignored++;
              ignored_event_ids.push(event.id);
            }
          } else {
            if (deliveryLogNotFoundFlag && !suppressionHandled) {
              would_ignore++;
            } else {
              processed_event_ids.push(event.id);
            }
          }
        } catch (err: any) {
          if (isDryRun) {
            would_fail++;
          } else {
            failed++;
            failed_event_ids.push(event.id);
            await supabaseAdmin
              .from("webhook_events")
              .update({
                status: "failed",
                error_message: err.message || "Unknown error",
              })
              .eq("id", event.id);
          }
        }
      }

      result = {
        success: true,
        dry_run: isDryRun,
        lock_acquired: true,
        scanned: (events || []).length,
        would_update_delivery_logs,
        updated_delivery_logs,
        delivery_log_not_found,
        would_suppress,
        suppressed,
        already_suppressed,
        would_ignore,
        ignored,
        would_fail,
        failed,
        processed_event_ids,
        ignored_event_ids,
        failed_event_ids,
      };
    } finally {
      // ─── 5. Always release lock, even on error ───────────────────────────────
      await supabaseAdmin.rpc("release_execution_lock", { p_lock_key: LOCK_KEY });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
