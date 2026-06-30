import { supabase } from "@/integrations/supabase/client";
import { evaluateMarketingSafety, MarketingSafetySettings, MarketingSafetyContext } from "./safetyRules";
import { getProviderAdapter } from "./providers";

export interface SendJobParams {
  channel: "email" | "zalo";
  provider?: string;
  recipient_email?: string;
  recipient_phone?: string;
  customer_id?: string;
  campaign_id?: string;
  workflow_id?: string;
  template_id?: string;
  payload?: any;
  idempotency_key?: string;
}

function checkIsSandboxInternal(channel: string, email?: string, phone?: string): boolean {
  const rec = email || phone || '';
  if (channel === 'email') {
    return rec.endsWith('@desembre.vn') || rec.includes('test');
  } else {
    return rec.startsWith('000') || rec.includes('test');
  }
}

export async function createSendJob(params: SendJobParams) {
  // 1. Fetch current safety settings
  const { data: settings } = await supabase
    .from("marketing_ops_safety_settings")
    .select("*")
    .eq("is_default", true)
    .single();

  const safeSettings: MarketingSafetySettings = settings || {
    global_kill_switch: true,
    email_enabled: false,
    zalo_enabled: false,
    require_admin_approval: true,
    daily_send_quota: 0,
    per_campaign_quota: 0,
    cooldown_minutes: 0,
    duplicate_prevention_hours: 24,
  };

  // 2. Fetch suppressions and preferences if customer_id/email/phone is provided
  let suppressions: any[] = [];
  let customerPreferences = null;

  if (params.customer_id) {
    const { data: prefData } = await supabase
      .from("customer_marketing_preferences")
      .select("*")
      .eq("customer_id", params.customer_id)
      .maybeSingle();
    customerPreferences = prefData;
  }

  if (params.customer_id || params.recipient_email || params.recipient_phone) {
    let q = supabase.from("marketing_suppression_list").select("*").eq("is_active", true);
    const { data: suppData } = await q;
    if (suppData) suppressions = suppData;
  }

  // 3. Prepare context
  const isInternal = !params.customer_id && checkIsSandboxInternal(params.channel, params.recipient_email, params.recipient_phone);
  
  const context: MarketingSafetyContext = {
    channel: params.channel,
    approved: false, // creation is not approved by default
    customer: {
      id: params.customer_id,
      email: params.recipient_email,
      phone: params.recipient_phone,
    },
    suppressions,
    current_daily_sends: 0, // Placeholder
    current_campaign_sends: 0, // Placeholder
    is_sandbox_internal: isInternal,
    customer_preferences: customerPreferences,
  };

  // 4. Evaluate Safety
  const evaluation = evaluateMarketingSafety(safeSettings, context);

  // 5. Insert Job
  const idempotencyKey = params.idempotency_key || `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const status = evaluation.allowed ? "queued" : "safety_blocked";
  
  const { data: job, error } = await supabase
    .from("marketing_send_jobs")
    .insert({
      channel: params.channel,
      provider: params.provider || "mock",
      recipient_email: params.recipient_email,
      recipient_phone: params.recipient_phone,
      customer_id: params.customer_id,
      campaign_id: params.campaign_id,
      workflow_id: params.workflow_id,
      template_id: params.template_id,
      payload: params.payload || {},
      idempotency_key: idempotencyKey,
      status: status,
      safety_result: { 
        reasons: evaluation.reasons, 
        warnings: evaluation.warnings,
        consent: evaluation.consent
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create send job: ${error.message}`);
  }

  return { job, evaluation };
}

export async function executeSendJob(jobId: string) {
  // 1. Fetch Job
  const { data: job, error: fetchError } = await supabase
    .from("marketing_send_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (fetchError || !job) {
    throw new Error("Job not found");
  }

  if (job.status !== "queued") {
    return { success: false, reason: `Job is not queued (current status: ${job.status})`, job };
  }

  // 2. Re-Evaluate Safety before execution (in case settings changed)
  const { data: settings } = await supabase
    .from("marketing_ops_safety_settings")
    .select("*")
    .eq("is_default", true)
    .single();

  const safeSettings: MarketingSafetySettings = settings || {
    global_kill_switch: true,
    email_enabled: false,
    zalo_enabled: false,
    require_admin_approval: true,
    daily_send_quota: 0,
    per_campaign_quota: 0,
    cooldown_minutes: 0,
    duplicate_prevention_hours: 24,
  };

  let suppressions: any[] = [];
  let customerPreferences = null;

  if (job.customer_id) {
    const { data: prefData } = await supabase
      .from("customer_marketing_preferences")
      .select("*")
      .eq("customer_id", job.customer_id)
      .maybeSingle();
    customerPreferences = prefData;
  }

  if (job.customer_id || job.recipient_email || job.recipient_phone) {
    let q = supabase.from("marketing_suppression_list").select("*").eq("is_active", true);
    const { data: suppData } = await q;
    if (suppData) suppressions = suppData;
  }

  const isInternal = !job.customer_id && checkIsSandboxInternal(job.channel, job.recipient_email, job.recipient_phone);

  const context: MarketingSafetyContext = {
    channel: job.channel as 'email' | 'zalo',
    approved: !!job.approved_at,
    customer: {
      id: job.customer_id,
      email: job.recipient_email,
      phone: job.recipient_phone,
    },
    suppressions,
    current_daily_sends: 0,
    current_campaign_sends: 0,
    is_sandbox_internal: isInternal,
    customer_preferences: customerPreferences,
  };

  const evaluation = evaluateMarketingSafety(safeSettings, context);

  if (!evaluation.allowed) {
    // Blocked at execution time
    const { data: updatedJob } = await supabase
      .from("marketing_send_jobs")
      .update({
        status: "safety_blocked",
        safety_result: { 
          reasons: evaluation.reasons, 
          warnings: evaluation.warnings,
          consent: evaluation.consent
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single();
      
    return { success: false, reason: "Blocked by safety rules at execution time", job: updatedJob };
  }

  // 3. Mark as Sending
  await supabase
    .from("marketing_send_jobs")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  // 4. Call Provider Adapter
  const adapter = getProviderAdapter(job.provider);
  try {
    const result = await adapter.sendMessage(job.payload);
    
    // 5. Update Success
    const { data: finalJob } = await supabase
      .from("marketing_send_jobs")
      .update({
        status: "sent",
        provider_message_id: result.provider_message_id,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single();
      
    return { success: true, job: finalJob };
  } catch (error: any) {
    // 6. Update Failure
    const { data: failedJob } = await supabase
      .from("marketing_send_jobs")
      .update({
        status: "failed",
        provider_error_message: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single();
      
    return { success: false, reason: "Provider execution failed", job: failedJob };
  }
}

async function verifyAdminRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleRow?.role;
  if (role !== "admin" && role !== "sub_admin") {
    throw new Error("Insufficient permissions: Admin role required");
  }
  return user.id;
}

export async function markJobApproved(jobId: string) {
  const userId = await verifyAdminRole();

  const { data: job, error } = await supabase
    .from("marketing_send_jobs")
    .update({
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve job: ${error.message}`);
  }

  return { success: true, job };
}

export async function reevaluateJobSafety(jobId: string) {
  await verifyAdminRole();

  const { data: job, error: fetchError } = await supabase
    .from("marketing_send_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (fetchError || !job) {
    throw new Error("Job not found");
  }

  const { data: settings } = await supabase
    .from("marketing_ops_safety_settings")
    .select("*")
    .eq("is_default", true)
    .single();

  const safeSettings: MarketingSafetySettings = settings || {
    global_kill_switch: true,
    email_enabled: false,
    zalo_enabled: false,
    require_admin_approval: true,
    daily_send_quota: 0,
    per_campaign_quota: 0,
    cooldown_minutes: 0,
    duplicate_prevention_hours: 24,
  };

  let suppressions: any[] = [];
  let customerPreferences = null;

  if (job.customer_id) {
    const { data: prefData } = await supabase
      .from("customer_marketing_preferences")
      .select("*")
      .eq("customer_id", job.customer_id)
      .maybeSingle();
    customerPreferences = prefData;
  }

  if (job.customer_id || job.recipient_email || job.recipient_phone) {
    let q = supabase.from("marketing_suppression_list").select("*").eq("is_active", true);
    const { data: suppData } = await q;
    if (suppData) suppressions = suppData;
  }

  const isInternal = !job.customer_id && checkIsSandboxInternal(job.channel, job.recipient_email, job.recipient_phone);

  const context: MarketingSafetyContext = {
    channel: job.channel as 'email' | 'zalo',
    approved: !!job.approved_at,
    customer: {
      id: job.customer_id,
      email: job.recipient_email,
      phone: job.recipient_phone,
    },
    suppressions,
    current_daily_sends: 0,
    current_campaign_sends: 0,
    is_sandbox_internal: isInternal,
    customer_preferences: customerPreferences,
  };

  const evaluation = evaluateMarketingSafety(safeSettings, context);

  let newStatus = job.status;
  if (job.status === "safety_blocked" && evaluation.allowed) {
    newStatus = "queued";
  } else if (!evaluation.allowed) {
    newStatus = "safety_blocked";
  }

  const { data: updatedJob, error } = await supabase
    .from("marketing_send_jobs")
    .update({
      status: newStatus,
      safety_result: { 
        reasons: evaluation.reasons, 
        warnings: evaluation.warnings,
        consent: evaluation.consent
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to re-evaluate safety: ${error.message}`);
  }

  return { success: true, allowed: evaluation.allowed, job: updatedJob };
}
