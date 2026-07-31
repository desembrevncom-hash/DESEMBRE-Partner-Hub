import { createClient } from '@supabase/supabase-js';
import { ZNS_TEMPLATE_MAPPING, resolveZnsTemplateConfig, isValidTemplateId } from './config.js';

function normalizeNotificationChannel(channel: string | null | undefined): 'zns' | null {
  const value = String(channel ?? '').trim().toLowerCase();

  if (['zns', 'zalo_zns', 'zalo-zns', 'zalo'].includes(value)) {
    return 'zns';
  }

  return null;
}

export async function safeResolveZaloCredential(senderKey: string) {
  const result: any = {
    ok: false,
    resolverCalled: false,
    resolverStatus: null,
    accessToken: null,
    errorCode: null,
    errorMessage: null
  };

  const hubSupabaseUrl = process.env['HUB_SUPABASE_URL'] || '';
  const hubInternalKey = process.env['HUB_INTERNAL_FUNCTION_KEY'] || '';

  if (!hubSupabaseUrl || !hubInternalKey) {
    result.errorCode = 'MISSING_ENV_CONFIG';
    result.errorMessage = 'HUB_SUPABASE_URL or HUB_INTERNAL_FUNCTION_KEY missing in Hub env';
    return result;
  }

  result.resolverCalled = true;

  try {
    const credRes = await fetch(`${hubSupabaseUrl}/functions/v1/resolve-zalo-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': hubInternalKey
      },
      body: JSON.stringify({ sender_key: senderKey })
    });
    
    result.resolverStatus = credRes.status;

    if (!credRes.ok) {
      const errText = await credRes.text();
      let safeReason = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error === "Not Found" || parsed.message?.includes("No active Zalo OA sender found")) {
          result.errorCode = 'SENDER_KEY_NOT_FOUND';
          result.errorMessage = `sender_key not found: ${senderKey}`;
          return result;
        }
        safeReason = parsed.message || parsed.error || `HTTP ${credRes.status}`;
      } catch(e) {}
      result.errorCode = `HTTP_${credRes.status}`;
      result.errorMessage = safeReason;
      return result;
    }
    
    const credData = await credRes.json();
    const token = credData.access_token || credData.accessToken || credData.token;
    
    if (token) {
       result.ok = true;
       result.accessToken = token;
    } else {
       result.errorCode = "ACCESS_TOKEN_MISSING";
       result.errorMessage = "Credential resolver response did not include access token";
    }
  } catch (err: any) {
    result.errorCode = 'FETCH_EXCEPTION';
    result.errorMessage = err.message;
  }

  return result;
}

function normalizeVietnamPhoneForZns(rawPhone: unknown): string | null {
  const digits = String(rawPhone ?? '').replace(/\D/g, '');

  if (!digits) return null;

  let normalized = digits;

  if (normalized.startsWith('0084')) {
    normalized = normalized.slice(2);
  } else if (normalized.startsWith('84')) {
    // already correct prefix
  } else if (normalized.startsWith('0')) {
    normalized = `84${normalized.slice(1)}`;
  } else if (normalized.length === 9) {
    normalized = `84${normalized}`;
  }

  if (!/^84[1-9][0-9]{8,9}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export async function processOutbox(mode: string, limit: number, triggeredBy: string = 'manual') {
  const supabaseUrl = process.env['ACADEMY_SUPABASE_URL'] || '';
  const serviceRoleKey = process.env['ACADEMY_SUPABASE_SERVICE_ROLE_KEY'] || '';

  const missingEnvs = [];
  if (!supabaseUrl) missingEnvs.push('ACADEMY_SUPABASE_URL');
  if (!serviceRoleKey) missingEnvs.push('ACADEMY_SUPABASE_SERVICE_ROLE_KEY');

  let zaloApiBaseUrl = '';
  let hubSupabaseUrl = '';
  let hubInternalKey = '';

  if (mode === 'real') {
    zaloApiBaseUrl = process.env['ZALO_API_BASE_URL'] || 'https://business.openapi.zalo.me';
    hubSupabaseUrl = process.env['HUB_SUPABASE_URL'] || '';
    hubInternalKey = process.env['HUB_INTERNAL_FUNCTION_KEY'] || '';

    if (!hubSupabaseUrl) missingEnvs.push('HUB_SUPABASE_URL');
    if (!hubInternalKey) missingEnvs.push('HUB_INTERNAL_FUNCTION_KEY');
  }

  if (missingEnvs.length > 0) {
    throw new Error(JSON.stringify({
      ok: false,
      error: 'Internal Gateway Config Error',
      missing: missingEnvs
    }));
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: {
      fetch: async (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(timeoutId);
          return response;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            throw new Error(JSON.stringify({ ok: false, error: 'TIMEOUT', step: 'supabase_rpc' }));
          }
          throw err;
        }
      }
    }
  });
  const workerId = `hub-zns-worker-${mode}`;
  const startedAt = new Date().toISOString();

  // Trigger 8AM Class Reminder RPC before claiming jobs
  try {
    const { data: remData, error: remErr } = await supabase.rpc('queue_class_reminder_zns');
    if (remErr) {
      console.log(`[ZNS Worker] queue_class_reminder_zns warning: ${remErr.message}`);
    } else {
      console.log(`[ZNS Worker] queue_class_reminder_zns result:`, JSON.stringify(remData));
    }
  } catch (remEx: any) {
    console.log(`[ZNS Worker] queue_class_reminder_zns exception: ${remEx.message}`);
  }

  const { data: claimData, error: claimErr } = await supabase.rpc('worker_claim_notification_jobs', {
    p_worker_id: workerId,
    p_limit: limit
  });

  if (claimErr) {
    throw new Error(claimErr.message);
  }

  const jobs = claimData as any[];
  if (!jobs || jobs.length === 0) {
    // Record run for 0 jobs
    await supabase.rpc('worker_record_notification_run', {
      p_worker_id: workerId,
      p_mode: mode,
      p_triggered_by: triggeredBy,
      p_processed_count: 0,
      p_sent_count: 0,
      p_failed_count: 0,
      p_skipped_count: 0,
      p_ok: true,
      p_error_message: null,
      p_started_at: startedAt,
      p_finished_at: new Date().toISOString()
    });

    return { ok: true, processed: 0, sent: 0, failed: 0, message: 'NO_QUEUED_JOBS', results: [] };
  }

  const results = [];
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const job of jobs) {
    if (mode === 'simulate') {
      try {
        await new Promise(r => setTimeout(r, 500));
        const isSuccess = Math.random() > 0.15;

        if (isSuccess) {
          const mockMsgId = 'ZNS-SIM-' + Math.random().toString(36).substring(2, 9).toUpperCase();
          await supabase.rpc('worker_mark_notification_sent', {
            p_job_id: job.id,
            p_provider_message_id: mockMsgId,
            p_provider_response: { note: 'Simulation success', phone: job.phone }
          });
          results.push({ id: job.id, status: 'sent', msgId: mockMsgId });
          sentCount++;
        } else {
          await supabase.rpc('worker_mark_notification_failed', {
            p_job_id: job.id,
            p_error_message: 'Simulation random failure',
            p_provider_response: { error: 'simulated_error' }
          });
          results.push({ id: job.id, status: 'failed', error: 'Simulation random failure' });
          failedCount++;
        }
      } catch (e: any) {
        results.push({ id: job.id, status: 'failed', error: e.message });
        failedCount++;
      }
    } else {
      // Real mode
      try {
        const normalizedChannel = normalizeNotificationChannel(job.channel);
        console.log(`[ZNS Worker] Processing job ${job.id} - original channel: ${job.channel}, normalized: ${normalizedChannel}`);
        
        if (normalizedChannel !== 'zns') {
          throw new Error(`Unsupported notification channel: ${job.channel}`);
        }

        const senderKey = job.sender_key || 'oa_desembre';
        
        // Resolve and validate template ID
        const templateConfig = resolveZnsTemplateConfig(senderKey, job.template_code);
        if (!templateConfig.ok) {
          throw new Error(templateConfig.message || `Template config invalid for ${job.template_code}`);
        }
        const templateId = templateConfig.templateId!;
        console.log(`[ZNS Worker] template resolved: code=${job.template_code} idLen=${templateId.length} idPrefix=${templateId.substring(0, 2)}`);

        // Phone resolution: RPC may return 'lead_phone', 'phone', or nothing depending on deployed version
        // Always log all available fields for debugging
        console.log(`[ZNS Worker] job fields: id=${job.id} registration_id=${job.registration_id} lead_phone_exists=${Boolean(job.lead_phone)} phone_exists=${Boolean(job.phone)} lead_name_exists=${Boolean(job.lead_name)} full_name_exists=${Boolean(job.full_name)}`);

        let rawPhone: string | null = job.lead_phone || job.phone || null;
        let recipientName: string = job.lead_name || job.full_name || 'Học viên';

        // Fallback: if phone not in RPC response, query course_registrations directly
        if (!rawPhone && job.registration_id) {
          console.log(`[ZNS Worker] Phone missing from RPC, querying course_registrations for registration_id=${job.registration_id}`);
          const { data: regData, error: regErr } = await supabase
            .from('course_registrations')
            .select('phone, full_name')
            .eq('id', job.registration_id)
            .single();

          if (regErr) {
            console.log(`[ZNS Worker] Fallback query failed: ${regErr.message}`);
          } else if (regData) {
            rawPhone = regData.phone || null;
            recipientName = regData.full_name || recipientName;
            console.log(`[ZNS Worker] Fallback phone fetched: digitsLen=${String(rawPhone ?? '').replace(/\D/g, '').length}`);
          }
        }

        const rawDigitsLen = String(rawPhone ?? '').replace(/\D/g, '').length;
        console.log(`[ZNS Worker] job=${job.id} hasRegistrationId=${Boolean(job.registration_id)} hasRawPhone=${Boolean(rawPhone)} rawPhoneDigitsLen=${rawDigitsLen}`);

        const znsPhone = normalizeVietnamPhoneForZns(rawPhone);

        if (!znsPhone) {
          throw new Error(`Invalid recipient phone after normalization: rawDigitsLen=${rawDigitsLen}`);
        }

        console.log(`[ZNS Worker] phone normalized: prefix=${znsPhone.substring(0, 4)} len=${znsPhone.length}`);

        // Extract payload values if available
        const payloadObj = (job.payload && typeof job.payload === 'object') ? job.payload : {};

        const customerName = payloadObj.customer_name || payloadObj.full_name || recipientName;
        const courseName = payloadObj.course_name || job.course_title || job.course_name || 'Khóa học Đào tạo';
        const trainingFormat = payloadObj.training_format || payloadObj.training_format_label || payloadObj.participation_format || 'Lớp đào tạo';
        const batchName = payloadObj.batch_name || payloadObj.batch_title || job.batch_title || job.batch_name || 'Đang cập nhật';
        const regIdStr = job.registration_id || job.id;
        const registrationCode = payloadObj.registration_code || regIdStr.replace(/-/g, '').substring(0, 8).toUpperCase();

        // Build clean template_data for ZNS API
        const templateData: Record<string, any> = {
          customer_name: customerName,
          full_name: customerName,
          course_name: courseName,
          training_format: trainingFormat,
          training_format_label: trainingFormat,
          participation_format: trainingFormat,
          batch_name: batchName,
          registration_code: registrationCode,
          support_phone: payloadObj.support_phone || job.support_phone || '0983392810',
          name: customerName
        };

        // Merge any remaining keys from payload
        for (const [k, v] of Object.entries(payloadObj)) {
          const cleanKey = k.replace(/[<>{}]/g, '').trim();
          if (v !== undefined && v !== null && v !== '' && !templateData[cleanKey]) {
            templateData[cleanKey] = v;
          }
        }

        const payload = {
          phone: znsPhone,
          template_id: templateId,
          template_data: templateData
        };

        console.log(`[ZNS Worker] payload pre-send: template_id_len=${templateId.length} template_code=${job.template_code} template_keys=${Object.keys(templateData).join(',')} phone_prefix=${znsPhone.substring(0, 4)} phone_len=${znsPhone.length}`);

        const endpoint = `${zaloApiBaseUrl}/message/template`;
        
        // Resolve credentials via Edge Function
        const resolution = await safeResolveZaloCredential(senderKey);
        
        if (!resolution.ok) {
          throw new Error(`ZNS Credential Resolver Error: ${resolution.errorMessage || resolution.errorCode}`);
        }
        
        const znsAccessToken = resolution.accessToken;

        const znsController = new AbortController();
        const znsTimeoutId = setTimeout(() => znsController.abort(), 10000);

        let znsRes;
        try {
          znsRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'access_token': znsAccessToken,
            },
            body: JSON.stringify(payload),
            signal: znsController.signal
          });
          clearTimeout(znsTimeoutId);
        } catch (fetchErr: any) {
          clearTimeout(znsTimeoutId);
          if (fetchErr.name === 'AbortError') {
            throw new Error(JSON.stringify({ ok: false, error: 'TIMEOUT', step: 'zalo_api' }));
          }
          throw fetchErr;
        }

        const znsData = await znsRes.json();

        if (znsData.error === 0) {
          const msgId = znsData.data?.msg_id || znsData.data?.message_id || znsData.data?.tracking_id || 'sent';
          await supabase.rpc('worker_mark_notification_sent', {
            p_job_id: job.id,
            p_provider_message_id: msgId,
            p_provider_response: znsData,
          });
          results.push({ id: job.id, status: 'sent', msgId: msgId });
          sentCount++;
        } else {
          const errorMsg = `ZNS API Error: ${znsData.message || 'Unknown'} (Code: ${znsData.error})`;
          await supabase.rpc('worker_mark_notification_failed', {
            p_job_id: job.id,
            p_error_message: errorMsg,
            p_provider_response: znsData,
          });
          results.push({ id: job.id, status: 'failed', error: znsData.message });
          failedCount++;
        }
      } catch (err: any) {
        try {
          await supabase.rpc('worker_mark_notification_failed', {
            p_job_id: job.id,
            p_error_message: `ZNS Exception: ${err.message}`,
            p_provider_response: null,
          });
        } catch (e) {}
        results.push({ id: job.id, status: 'failed', error: err.message });
        failedCount++;
      }
    }
  }

  const finishedAt = new Date().toISOString();

  await supabase.rpc('worker_record_notification_run', {
    p_worker_id: workerId,
    p_mode: mode,
    p_triggered_by: triggeredBy,
    p_processed_count: jobs.length,
    p_sent_count: sentCount,
    p_failed_count: failedCount,
    p_skipped_count: skippedCount,
    p_ok: true,
    p_error_message: null,
    p_started_at: startedAt,
    p_finished_at: finishedAt
  });

  return {
    ok: true,
    processed: jobs.length,
    sent: sentCount,
    failed: failedCount,
    results
  };
}
