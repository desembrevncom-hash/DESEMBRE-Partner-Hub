import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Auth + Role Verification
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: "Thiếu Authorization" }), { status: 401, headers: corsHeaders });
  }

  const { data: { user }, error: authErr } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  const isAdminOrSubAdmin = roleData?.role === "admin" || roleData?.role === "sub_admin";
  if (!isAdminOrSubAdmin) {
    return new Response(JSON.stringify({ success: false, error: "Chỉ Admin/SubAdmin mới được phép gửi chiến dịch" }), { status: 403, headers: corsHeaders });
  }

  // 2. Parse request body
  let body: { campaign_id: string; batch_size?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), { status: 400, headers: corsHeaders });
  }

  const { campaign_id, batch_size = 30 } = body;
  if (!campaign_id) {
    return new Response(JSON.stringify({ success: false, error: "Tham số campaign_id là bắt buộc" }), { status: 400, headers: corsHeaders });
  }

  try {
    // 3. Load Campaign details
    const { data: campaign, error: campaignErr } = await adminClient
      .from("marketing_campaigns")
      .select("*, sender_accounts(*)")
      .eq("id", campaign_id)
      .maybeSingle();

    if (campaignErr || !campaign) {
      throw new Error(`Chiến dịch không tồn tại: ${campaignErr?.message || ""}`);
    }

    if (["completed", "cancelled", "failed"].includes(campaign.status)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Chiến dịch đã ở trạng thái kết thúc (${campaign.status}) và không thể gửi tiếp.`,
        campaign_status: campaign.status
      }), { status: 400, headers: corsHeaders });
    }

    const sender = campaign.sender_accounts;
    if (!sender) {
      throw new Error("Không tìm thấy thông tin tài khoản gửi (Sender Account)");
    }

    // 4. Sender Protections (Circuit Breaker, Daily Limit & Retry Overload)
    // Protection A: Sender Degradation check
    if (!sender.is_active || sender.health_status === "degraded") {
      const reason = `Tài khoản gửi đang bị lỗi hoặc hạn chế (Trạng thái: ${sender.health_status})`;
      await adminClient.from("marketing_campaigns").update({
        status: "paused",
        paused_at: new Date().toISOString(),
        failure_reason: reason
      }).eq("id", campaign_id);

      return new Response(JSON.stringify({
        success: false,
        paused: true,
        error: reason,
        campaign_status: "paused"
      }), { headers: corsHeaders });
    }

    // Protection B: Daily limit usage > 90% check
    const dailyLimit = sender.daily_limit || 1000;
    const dailyUsage = sender.daily_usage || 0;
    if (dailyUsage >= dailyLimit * 0.9) {
      const reason = `Hạn ngạch ngày của tài khoản gửi vượt quá 90% (${dailyUsage}/${dailyLimit})`;
      await adminClient.from("marketing_campaigns").update({
        status: "paused",
        paused_at: new Date().toISOString(),
        failure_reason: reason
      }).eq("id", campaign_id);

      return new Response(JSON.stringify({
        success: false,
        paused: true,
        error: reason,
        campaign_status: "paused"
      }), { headers: corsHeaders });
    }

    // Protection C: Retry queue pressure check (> 50 pending retries for this sender)
    const { count: pendingRetryCount, error: retryCountErr } = await adminClient
      .from("marketing_retry_queue")
      .select("*", { count: "exact", head: true })
      .eq("sender_account_id", sender.id)
      .eq("status", "pending");

    if (!retryCountErr && pendingRetryCount !== null && pendingRetryCount > 50) {
      const reason = `Hàng đợi thử lại quá tải (${pendingRetryCount} tin nhắn pending)`;
      await adminClient.from("marketing_campaigns").update({
        status: "paused",
        paused_at: new Date().toISOString(),
        failure_reason: reason
      }).eq("id", campaign_id);

      return new Response(JSON.stringify({
        success: false,
        paused: true,
        error: reason,
        campaign_status: "paused"
      }), { headers: corsHeaders });
    }

    // 5. Update campaign status to 'sending' if it was queued, approved, or paused
    if (["approved", "queued", "paused"].includes(campaign.status)) {
      const updates: Record<string, any> = {
        status: "sending",
        updated_at: new Date().toISOString()
      };
      if (!campaign.started_at) {
        updates.started_at = new Date().toISOString();
      }
      await adminClient.from("marketing_campaigns").update(updates).eq("id", campaign_id);
    }

    // 5.5 Validate that snapshots exist (mandatory snapshot check)
    const { count: totalSnapshots, error: countErr } = await adminClient
      .from("campaign_recipient_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id);

    if (countErr) throw countErr;
    if (totalSnapshots === 0 || totalSnapshots === null) {
      return new Response(JSON.stringify({
        success: false,
        error: "Chiến dịch chưa được đóng băng danh sách người nhận (snapshot). Vui lòng phê duyệt chiến dịch để tạo snapshot trước khi gửi."
      }), { status: 400, headers: corsHeaders });
    }

    // 6. Query Snapshot Recipients
    const { data: snapshots, error: snapErr } = await adminClient
      .from("campaign_recipient_snapshots")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(batch_size);

    if (snapErr) throw snapErr;

    if (!snapshots || snapshots.length === 0) {
      // Double check if there are any remaining queued recipients at all
      const { count: remainingQueued } = await adminClient
        .from("campaign_recipient_snapshots")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id)
        .eq("status", "queued");

      if (remainingQueued === 0) {
        // Complete the campaign
        await adminClient.from("marketing_campaigns").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", campaign_id);

        return new Response(JSON.stringify({
          success: true,
          finished: true,
          message: "Chiến dịch đã hoàn thành gửi toàn bộ người nhận.",
          campaign_status: "completed"
        }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        success: true,
        finished: false,
        processed: 0,
        message: "Không tìm thấy người nhận trong lô này nhưng vẫn còn hàng đợi.",
        campaign_status: "sending"
      }), { headers: corsHeaders });
    }

    // 7. Process batch of recipients
    let batchSuccessful = 0;
    let batchFailed = 0;
    let batchBlocked = 0;
    let circuitTripped = false;
    let tripReason = "";

    for (const snap of snapshots) {
      // Check if campaign status has been changed to paused or cancelled during runtime by another process
      const { data: currentCamp } = await adminClient
        .from("marketing_campaigns")
        .select("status")
        .eq("id", campaign_id)
        .maybeSingle();

      if (currentCamp && currentCamp.status !== "sending") {
        // Immediately halt sending new messages in the batch
        break;
      }

      try {
        // Call standard send-zns-message Edge Function
        const znsSendUrl = `${supabaseUrl}/functions/v1/send-zns-message`;
        const sendRes = await fetch(znsSendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify({
            customer_id: snap.customer_id,
            zns_template_id: snap.zns_template_id,
            template_data: snap.payload_preview,
            mode: "provider_send"
          })
        });

        const sendResult = await sendRes.json();

        if (sendRes.ok && sendResult.allowed) {
          // Success
          batchSuccessful++;
          await adminClient
            .from("campaign_recipient_snapshots")
            .update({
              status: "sent",
              delivery_log_id: sendResult.delivery_log_id || null,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", snap.id);
        } else {
          // Failed or Blocked
          const reasonCode = sendResult.reason_code || "";
          const isBlocked = ["OPT_OUT_BLOCKED", "MISSING_PHONE", "INVALID_PHONE", "DUPLICATE_BLOCKED"].includes(reasonCode);
          
          if (isBlocked) {
            batchBlocked++;
          } else {
            batchFailed++;
          }

          await adminClient
            .from("campaign_recipient_snapshots")
            .update({
              status: isBlocked ? "blocked" : "failed",
              delivery_log_id: sendResult.delivery_log_id || null,
              failure_reason: sendResult.reason || "Bị từ chối gửi",
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", snap.id);

          // Handle circuit breaker tripped condition
          if (sendResult.tripped_circuit_breaker) {
            circuitTripped = true;
            tripReason = sendResult.reason || "Circuit breaker tripped";
            break; // Stop loop
          }
        }
      } catch (err: any) {
        batchFailed++;
        await adminClient
          .from("campaign_recipient_snapshots")
          .update({
            status: "failed",
            failure_reason: `Lỗi kết nối Edge Function: ${err.message}`,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", snap.id);
      }
    }

    // 8. Update Campaign stats
    const processedThisBatch = batchSuccessful + batchFailed + batchBlocked;

    const { data: updatedCamp } = await adminClient.rpc("increment_campaign_metrics", {
      p_campaign_id: campaign_id,
      p_processed: processedThisBatch,
      p_successful: batchSuccessful,
      p_failed: batchFailed + batchBlocked
    });

    // 9. If circuit breaker tripped, force pause campaign
    if (circuitTripped) {
      await adminClient.from("marketing_campaigns").update({
        status: "paused",
        paused_at: new Date().toISOString(),
        failure_reason: `Gửi tin thất bại hàng loạt: ${tripReason}`
      }).eq("id", campaign_id);

      return new Response(JSON.stringify({
        success: true,
        finished: false,
        processed: processedThisBatch,
        successful: batchSuccessful,
        failed: batchFailed,
        blocked: batchBlocked,
        paused: true,
        error: `Tài khoản gửi bị ngắt mạch (Circuit Breaker). Chiến dịch tự động tạm dừng.`,
        campaign_status: "paused"
      }), { headers: corsHeaders });
    }

    // 10. Check if completely finished
    const { count: remainingQueuedCount } = await adminClient
      .from("campaign_recipient_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "queued");

    let finalStatus = "sending";
    if (remainingQueuedCount === 0) {
      finalStatus = "completed";
      await adminClient.from("marketing_campaigns").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq("id", campaign_id);
    }

    return new Response(JSON.stringify({
      success: true,
      finished: finalStatus === "completed",
      processed: processedThisBatch,
      successful: batchSuccessful,
      failed: batchFailed,
      blocked: batchBlocked,
      campaign_status: finalStatus,
      remaining: remainingQueuedCount || 0
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
