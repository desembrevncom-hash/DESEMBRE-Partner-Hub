import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

// Read .env.staging or .env
let env = {};
if (fs.existsSync(".env.staging")) {
  const envText = fs.readFileSync(".env.staging", "utf8");
  envText.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join("=").replace(/\"/g, "").replace(/\'/g, "").trim();
    }
  });
}
if (fs.existsSync(".env") && Object.keys(env).length <= 10) { 
  const envText = fs.readFileSync(".env", "utf8");
  envText.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2 && !env[parts[0].trim()]) {
      env[parts[0].trim()] = parts.slice(1).join("=").replace(/\"/g, "").replace(/\'/g, "").trim();
    }
  });
}
Object.assign(env, process.env);

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = env.ZALO_WEBHOOK_WORKER_CRON_SECRET || 'test_secret_for_cron';
const KEEP_QA_DATA = env.KEEP_QA_DATA === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CRON_SECRET) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ZALO_WEBHOOK_WORKER_CRON_SECRET in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MOCK_PROVIDER_MSG_ID = 'qa-zalo-msg-123';
const MOCK_PROVIDER_MSG_ID_FAIL = 'qa-zalo-msg-124';
const MOCK_DELIVERED_EVENT_ID = crypto.randomUUID();
const MOCK_FAILED_EVENT_ID = crypto.randomUUID();
const MOCK_DELIVERED_DEDUPE_KEY = 'qa-zalo-delivered-123';
const MOCK_FAILED_DEDUPE_KEY = 'qa-zalo-failed-124';

async function cleanup() {
  console.log("Cleaning up targeted QA data...");
  await supabase.from('webhook_events').delete().like('dedupe_key', 'qa-%');
  await supabase.from('marketing_delivery_logs').delete().like('provider_message_id', 'qa-%');
}

async function runSmokeTest() {
  console.log("=== STARTING ZALO WEBHOOK M10D SMOKE TEST ===");

  await cleanup();

  console.log("\n1. Discovering dependency for QA seed...");
  const { data: dep, error: depErr } = await supabase
    .from('marketing_campaign_recipients_snapshot')
    .select('campaign_id, customer_id')
    .not('customer_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (depErr || !dep) {
    console.error("FAIL: Missing campaign/customer dependency for QA seed", depErr);
    process.exit(1);
  }
  const { campaign_id, customer_id } = dep;
  console.log(`Found dependency: campaign_id=${campaign_id}, customer_id=${customer_id}`);

  console.log("\n2. Seeding mock marketing_delivery_logs...");
  const { error: logErr } = await supabase.from('marketing_delivery_logs').insert([
    {
      campaign_id,
      customer_id,
      channel: 'zalo_zns',
      status: 'sent',
      provider_message_id: MOCK_PROVIDER_MSG_ID,
      reason: null,
      delivery_metadata: {},
      provider_response: {},
      retry_count: 0
    },
    {
      campaign_id,
      customer_id,
      channel: 'zalo_zns',
      status: 'sent',
      provider_message_id: MOCK_PROVIDER_MSG_ID_FAIL,
      reason: null,
      delivery_metadata: {},
      provider_response: {},
      retry_count: 0
    }
  ]);

  if (logErr) {
    console.error("FAIL: Could not seed delivery logs", logErr);
    process.exit(1);
  }
  console.log("- delivery log seed PASS");

  console.log("\n3. Seeding mock webhook_events...");
  const { error: evErr } = await supabase.from('webhook_events').insert([
    {
      id: MOCK_DELIVERED_EVENT_ID,
      dedupe_key: MOCK_DELIVERED_DEDUPE_KEY,
      provider: 'zalo',
      event_type: 'zns_delivered',
      related_message_id: MOCK_PROVIDER_MSG_ID,
      status: 'received',
      signature_valid: true,
      payload: { 
        event_name: 'zns_status', 
        message: { msg_id: MOCK_PROVIDER_MSG_ID, delivery_status: 1 } 
      }
    },
    {
      id: MOCK_FAILED_EVENT_ID,
      dedupe_key: MOCK_FAILED_DEDUPE_KEY,
      provider: 'zalo',
      event_type: 'zns_failed',
      related_message_id: MOCK_PROVIDER_MSG_ID_FAIL,
      status: 'received',
      signature_valid: true,
      payload: { 
        event_name: 'zns_status', 
        message: { msg_id: MOCK_PROVIDER_MSG_ID_FAIL, delivery_status: -1 } 
      }
    }
  ]);

  if (evErr) {
    console.error("FAIL: Could not seed webhook events", evErr);
    process.exit(1);
  }
  console.log("- webhook_events zns_delivered/zns_failed inserted PASS");

  console.log("\n4. Invoking process-zalo-webhook-events Edge Function...");
  const functionUrl = `${SUPABASE_URL}/functions/v1/process-zalo-webhook-events`;
  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': CRON_SECRET
      },
      body: JSON.stringify({ confirm: 'PROCESS_ZALO_WEBHOOKS' })
    });
    
    if (!res.ok) {
       console.error(`FAIL: Edge function returned HTTP ${res.status}`);
       const text = await res.text();
       console.error(text);
       process.exit(1);
    }
    
    const result = await res.json();
    console.log("- Edge Function Response Body:", JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error("FAIL: Edge function logic failed", result);
      process.exit(1);
    }
    console.log("- process-zalo-webhook-events HTTP 200 PASS");
  } catch (err) {
    console.error("FAIL: Fetch error", err);
    process.exit(1);
  }

  console.log("\n5. Asserting Results...");
  let assertionsPassed = 0;

  // Assert delivery logs
  const { data: logs } = await supabase.from('marketing_delivery_logs')
    .select('provider_message_id, status, reason')
    .in('provider_message_id', [MOCK_PROVIDER_MSG_ID, MOCK_PROVIDER_MSG_ID_FAIL]);
  
  const deliveredLog = logs?.find(l => l.provider_message_id === MOCK_PROVIDER_MSG_ID);
  const failedLog = logs?.find(l => l.provider_message_id === MOCK_PROVIDER_MSG_ID_FAIL);

  if (deliveredLog?.status === 'delivered' && failedLog?.status === 'failed') {
    console.log("- marketing_delivery_logs status mapped PASS");
    assertionsPassed++;
  } else {
    console.error("FAIL: marketing_delivery_logs status mapping failed.", logs);
  }

  // Assert webhook events
  const { data: events } = await supabase.from('webhook_events')
    .select('id, dedupe_key, status')
    .in('dedupe_key', [MOCK_DELIVERED_DEDUPE_KEY, MOCK_FAILED_DEDUPE_KEY]);
  
  if (events && events.length === 2 && events.every(e => e.status === 'processed')) {
    console.log("- webhook_events processed/skipped status PASS");
    assertionsPassed++;
  } else {
    console.error("FAIL: Webhook events not fully processed.", events);
  }

  if (assertionsPassed === 2) {
    console.log("\nALL M10D ZALO ASSERTIONS PASSED! 🎉");
  } else {
    console.error(`\nFAILED: Only ${assertionsPassed}/2 assertions passed.`);
    process.exit(1);
  }

  if (!KEEP_QA_DATA) {
    console.log("\nCleaning up QA data (KEEP_QA_DATA=false)...");
    await cleanup();
  } else {
    console.log("\nSkipping cleanup because KEEP_QA_DATA=true.");
  }
}

runSmokeTest().catch(console.error);
