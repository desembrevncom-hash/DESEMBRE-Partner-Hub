import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const appId = process.env['ZALO_APP_ID'] || '';
    const oaSecretKey = process.env['ZALO_OA_SECRET_KEY'] || '';
    const webhookSecret = process.env['ZALO_WEBHOOK_SECRET'] || '';
    
    const isProd = process.env.NODE_ENV === 'production';
    
    if (isProd && (!appId || !oaSecretKey)) {
      console.error('[Zalo Webhook] Missing ZALO_APP_ID or ZALO_OA_SECRET_KEY in production mode');
      return res.status(500).json({ error: 'Missing Zalo App credentials' });
    }

    const signature = req.headers['x-zevent-signature'] || req.headers['X-ZEvent-Signature'];
    const timestamp = req.headers['x-zevent-timestamp'] || req.headers['X-ZEvent-Timestamp'];
    
    let isVerified = false;

    if (appId && oaSecretKey && timestamp && signature) {
      // Get raw body, fallback to stringified body
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      
      const payloadString = appId + rawBody + timestamp + oaSecretKey;
      const expectedSignature = crypto.createHash('sha256').update(payloadString).digest('hex');
      
      if (signature === expectedSignature) {
        isVerified = true;
      } else {
        console.warn(`[Zalo Webhook] Signature mismatch. Expected: ${expectedSignature}, Got: ${signature}`);
      }
    }

    // Fallback for dev/staging if signature verification didn't run or failed, but we have a webhook secret
    if (!isVerified && webhookSecret && !isProd) {
      const providedSecret = req.headers['x-zalo-webhook-secret'];
      if (providedSecret === webhookSecret) {
        isVerified = true;
        console.log('[Zalo Webhook] Verified using fallback ZALO_WEBHOOK_SECRET (dev/staging only)');
      }
    }

    if (!isVerified) {
      return res.status(401).json({ error: 'Unauthorized webhook call' });
    }

    const payload = req.body || {};
    
    // Extract provider_message_id (Zalo typically uses message_id, msg_id, or tracking_id in callbacks)
    const providerMessageId = payload.message_id || payload.msg_id || payload.tracking_id || payload.id;
    const eventType = payload.event_name || payload.status || 'unknown';

    // Log the event securely (no phone numbers/tokens)
    console.log(`[Zalo Webhook] Event: ${eventType} | MsgID: ${providerMessageId}`);

    const supabaseUrl = process.env['ACADEMY_SUPABASE_URL'] || '';
    const serviceRoleKey = process.env['ACADEMY_SUPABASE_SERVICE_ROLE_KEY'] || '';

    const missingEnvs = [];
    if (!supabaseUrl) missingEnvs.push('ACADEMY_SUPABASE_URL');
    if (!serviceRoleKey) missingEnvs.push('ACADEMY_SUPABASE_SERVICE_ROLE_KEY');
    if (!process.env['ZALO_WEBHOOK_SECRET']) missingEnvs.push('ZALO_WEBHOOK_SECRET');

    console.log(`[Zalo Webhook] Config Status:
      hasAcademySupabaseUrl: ${!!supabaseUrl}
      hasAcademyServiceRoleKey: ${!!serviceRoleKey}
      hasZaloWebhookSecret: ${!!process.env['ZALO_WEBHOOK_SECRET']}
    `);

    if (missingEnvs.length > 0) {
      return res.status(500).json({ 
        ok: false, 
        error: 'Internal Gateway Config Error',
        missing: missingEnvs
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Call the RPC to record the event
    const { data, error } = await supabase.rpc('worker_record_notification_provider_event', {
      p_provider: 'zalo',
      p_provider_message_id: providerMessageId || '',
      p_event_type: eventType,
      p_raw_payload: payload
    });

    if (error) {
      console.error('[Zalo Webhook] RPC Error:', error.message);
      // We still return 200 to Zalo so it doesn't retry unnecessarily if our DB failed
      return res.status(200).json({ ok: false, error: 'RPC failed' });
    }

    return res.status(200).json({ ok: true, matched: data?.matched });
  } catch (error: any) {
    console.error('[Zalo Webhook] Exception:', error.message);
    return res.status(200).json({ ok: false, error: 'Internal Exception' });
  }
}
