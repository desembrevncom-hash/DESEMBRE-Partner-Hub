import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.44.2";

// Import safety helpers (assume they exist in shared or we re-implement standard checks if they depend on local node modules)
// For Deno edge functions, we usually use shared code from a common repo, but since we're in M42.2 we will implement 
// the pure safety engine logic inline for the edge function to avoid complex Deno/Node module resolution issues.

interface AutomationRecipient {
  id: string;
  batch_id: string;
  workflow_id: string;
  customer_id: string | null;
  channel: string;
  provider: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  idempotency_key: string;
  attempt_count: number;
}

export async function processQueueHandler(supabaseUrl: string, supabaseServiceKey: string) {
  // Use service role to bypass RLS and execute RPC
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Claim up to 50 pending recipients
  const { data: claimed, error: claimError } = await supabase.rpc('claim_pending_automation_recipients', { limit_count: 50 });
  
  if (claimError) {
    console.error("Error claiming recipients:", claimError);
    return { success: false, error: claimError.message };
  }

  if (!claimed || claimed.length === 0) {
    return { success: true, processed: 0, message: "No pending recipients found." };
  }

  console.log(`Claimed ${claimed.length} recipients for processing.`);

  let processedCount = 0;

  // Cache settings and preferences to avoid N+1 where possible, or just fetch per recipient.
  // We'll fetch global safety settings first.
  const { data: safetySettings } = await supabase
    .from('marketing_ops_safety_settings')
    .select('*')
    .eq('is_default', true)
    .single();

  const killSwitch = safetySettings?.global_kill_switch === true;

  for (const recipient of claimed as AutomationRecipient[]) {
    try {
      await processRecipient(supabase, recipient, killSwitch, safetySettings);
      processedCount++;
    } catch (e: any) {
      console.error(`Failed to process recipient ${recipient.id}:`, e);
      // Fallback mark as failed if unexpected error occurs
      await supabase.from('marketing_automation_run_recipients').update({
        status: 'failed',
        last_error: e.message,
        updated_at: new Date().toISOString()
      }).eq('id', recipient.id);
    }
  }

  return { success: true, processed: processedCount };
}

async function processRecipient(
  supabase: SupabaseClient, 
  recipient: AutomationRecipient, 
  killSwitch: boolean,
  safetySettings: any
) {
  let allowed = true;
  let reason = "";

  // 1. Zalo Block
  if (recipient.channel === 'zalo') {
    allowed = false;
    reason = "Zalo is not enabled for automation yet.";
  }

  // 2. Resend / Real Provider Block (M42.2)
  if (allowed && recipient.provider === 'resend') {
    allowed = false;
    reason = "Provider 'resend' is blocked in M42.2 manual runner. Only 'mock' is allowed.";
  }

  // 3. Global Kill Switch
  if (allowed && killSwitch) {
    allowed = false;
    reason = "Global Kill Switch is active.";
  }

  // 4. Quota
  if (allowed && safetySettings && safetySettings.daily_send_quota <= 0) {
    allowed = false;
    reason = "Daily quota reached or set to 0.";
  }

  // 5. Consent Gate
  let customerPrefs = null;
  if (allowed && recipient.customer_id) {
    const { data: prefs } = await supabase
      .from('customer_marketing_preferences')
      .select('*')
      .eq('customer_id', recipient.customer_id)
      .single();
    
    if (prefs) {
      customerPrefs = prefs;
      if (prefs.global_opt_out) {
        allowed = false;
        reason = "Consent Gate Blocked: Global opt-out.";
      } else if (recipient.channel === 'email' && !prefs.email_opt_in) {
        allowed = false;
        reason = "Consent Gate Blocked: Email not opted in.";
      } else if (recipient.channel === 'zalo' && !prefs.zalo_opt_in) {
        allowed = false;
        reason = "Consent Gate Blocked: Zalo not opted in.";
      }
    } else {
      allowed = false;
      reason = "Consent Gate Blocked: Missing marketing preferences record.";
    }
  } else if (allowed && !recipient.customer_id) {
    // If no customer ID (e.g. ad-hoc), we still enforce strict block unless it's a sandbox
    // For M42.2, we require a customer for consent
    allowed = false;
    reason = "Missing customer ID for consent evaluation.";
  }

  const safetyResult = {
    allowed,
    reasons: allowed ? [] : [reason],
    automation: {
      runner: "process-automation-queue",
      mode: "mock",
      would_send: false,
      provider_call: false,
      reason: "M42.2 mock-only automation execution"
    }
  };

  if (!allowed) {
    await supabase.from('marketing_automation_run_recipients').update({
      status: 'blocked',
      safety_result: safetyResult,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', recipient.id);

    // Update batch conditionally
    await updateBatchStatus(supabase, recipient.batch_id);
    return;
  }

  // Eligible & Mock
  // Insert exactly one marketing_send_job
  // Get batch info to copy created_by if needed
  const { data: batch } = await supabase.from('marketing_automation_run_batches').select('created_by').eq('id', recipient.batch_id).single();

  const mockJobPayload = {
    provider: 'mock',
    status: 'skipped',
    provider_message_id: null,
    idempotency_key: recipient.idempotency_key,
    channel: recipient.channel,
    customer_id: recipient.customer_id,
    recipient: recipient.channel === 'email' ? recipient.recipient_email : recipient.recipient_phone,
    workflow_id: recipient.workflow_id,
    created_by: batch?.created_by || null,
    safety_result: safetyResult
  };

  // We use insert but catch unique violation for idempotency
  let sendJobId = null;
  const { data: insertedJob, error: insertError } = await supabase
    .from('marketing_send_jobs')
    .insert([mockJobPayload])
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') { // unique violation
      // It means a job with this idempotency key already exists.
      // We will skip inserting and mark recipient as skipped
      const { data: existingJob } = await supabase
        .from('marketing_send_jobs')
        .select('id')
        .eq('idempotency_key', recipient.idempotency_key)
        .single();
      
      if (existingJob) sendJobId = existingJob.id;
    } else {
      throw insertError;
    }
  } else if (insertedJob) {
    sendJobId = insertedJob.id;
  }

  await supabase.from('marketing_automation_run_recipients').update({
    status: insertError && insertError.code === '23505' ? 'skipped' : 'completed',
    send_job_id: sendJobId,
    safety_result: safetyResult,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', recipient.id);

  // Update batch conditionally
  await updateBatchStatus(supabase, recipient.batch_id);
}

// Minimal safe batch updating logic
async function updateBatchStatus(supabase: SupabaseClient, batchId: string) {
  // We need to fetch all recipients for this batch to evaluate terminal status
  const { data: siblings } = await supabase
    .from('marketing_automation_run_recipients')
    .select('status')
    .eq('batch_id', batchId);

  if (!siblings || siblings.length === 0) return;

  const total = siblings.length;
  const pendingOrProcessing = siblings.filter(s => s.status === 'pending' || s.status === 'processing').length;
  const failed = siblings.filter(s => s.status === 'failed').length;
  const blocked = siblings.filter(s => s.status === 'blocked').length;
  const completedOrSkipped = siblings.filter(s => s.status === 'completed' || s.status === 'skipped').length;

  if (pendingOrProcessing > 0) {
    // Still processing
    await supabase.from('marketing_automation_run_batches').update({
      status: 'processing',
      updated_at: new Date().toISOString()
    }).eq('id', batchId).eq('status', 'approved'); // Only upgrade if approved
    return;
  }

  // All terminal
  let finalStatus = 'completed';
  if (failed > 0) finalStatus = 'failed';
  else if (blocked === total) finalStatus = 'blocked';

  const summary = {
    total,
    completed: completedOrSkipped,
    blocked,
    failed
  };

  // Ensure batch has approved_by and approved_at before marking terminal
  const { data: batchCheck } = await supabase
    .from('marketing_automation_run_batches')
    .select('approved_by, approved_at')
    .eq('id', batchId)
    .single();

  if (batchCheck && batchCheck.approved_by && batchCheck.approved_at) {
    await supabase.from('marketing_automation_run_batches').update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      summary,
      updated_at: new Date().toISOString()
    }).eq('id', batchId);
  }
}
