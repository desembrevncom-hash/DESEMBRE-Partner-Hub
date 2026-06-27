import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

// Read .env.staging or .env
let env = {};
if (fs.existsSync(".env.staging")) {
  const envText = fs.readFileSync(".env.staging", "utf8");
  envText.split("\n").forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  });
}

const SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZALO_APP_SECRET = env.ZALO_APP_SECRET || process.env.ZALO_APP_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ZALO_APP_SECRET) {
  console.error("Missing required env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ZALO_APP_SECRET) in .env.staging");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const QA_PREFIX = 'qa-m10c-zalo-';
const MOCK_MSG_ID = `${QA_PREFIX}msg-${Date.now()}`;

async function cleanup() {
  console.log("\n[Cleanup] Removing qa-m10c-zalo-* data...");
  const { data: events } = await supabaseAdmin
    .from("webhook_events")
    .delete()
    .like('dedupe_key', `%${QA_PREFIX}%`) // dedupe key contains the msg_id for zalo
    .select('id');
  console.log(`- webhook_events cleaned: ${events?.length || 0} rows`);
}

async function run() {
  console.log("=== START: Smoke Test Zalo Webhook Receiver ===");

  if (process.env.KEEP_QA_DATA !== 'true') {
    await cleanup();
  }

  const payload = {
    app_id: "12345",
    event_name: "zns_delivered",
    message: { msg_id: MOCK_MSG_ID },
    timestamp: Date.now().toString(),
  };
  const payloadString = JSON.stringify(payload);
  const timestamp = payload.timestamp;
  const appId = payload.app_id;
  
  // ZCA Webhook MAC = sha256(appId + jsonBody + timestamp + secretKey)
  const toSign = appId + payloadString + timestamp + ZALO_APP_SECRET;
  const expectedMac = crypto.createHash('sha256').update(toSign).digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'X-ZECA-Event': 'zns_delivered',
    'X-ZECA-Timestamp': timestamp,
    'X-ZECA-Signature': expectedMac
  };

  const functionUrl = `${SUPABASE_URL}/functions/v1/zalo-webhook`;
  
  console.log(`\n1. Sending valid webhook to ${functionUrl}`);
  console.log(`- related_message_id: ${MOCK_MSG_ID}`);

  const res = await fetch(functionUrl, {
    method: 'POST',
    headers,
    body: payloadString
  });

  const text = await res.text();
  console.log(`- HTTP Status: ${res.status}`);
  console.log(`- Response: ${text}`);

  if (res.status !== 200) {
    console.error("FAIL: Webhook returned non-200");
    process.exit(1);
  }

  let resultJson = {};
  try {
    resultJson = JSON.parse(text);
  } catch(e) {}

  if (!resultJson.success) {
    console.error("FAIL: Receiver returned success=false");
    process.exit(1);
  }

  console.log("\n2. Verifying DB Insertion in webhook_events");
  // Zalo dedupe_key = event_name + message_id + timestamp
  const expectedDedupeKey = `zns_delivered_${MOCK_MSG_ID}_${timestamp}`;

  const { data: dbEvent, error } = await supabaseAdmin
    .from("webhook_events")
    .select("*")
    .eq('dedupe_key', expectedDedupeKey)
    .single();

  if (error || !dbEvent) {
    console.error("FAIL: Could not find the event in webhook_events");
    console.error(error);
    process.exit(1);
  }

  console.log(`- Found row in webhook_events (id: ${dbEvent.id})`);
  console.assert(dbEvent.provider === 'zalo_zbs', "Provider should be zalo_zbs for ZNS");
  console.assert(dbEvent.event_type === 'zns_delivered', "Event type should match");
  console.assert(dbEvent.related_message_id === MOCK_MSG_ID, "related_message_id should match");
  console.assert(dbEvent.signature_valid === true, "signature_valid should be true");

  console.log("\n3. Testing Duplicate Webhook Reject");
  const resDup = await fetch(functionUrl, {
    method: 'POST',
    headers,
    body: payloadString
  });
  const dupText = await resDup.text();
  console.log(`- Duplicate HTTP Status: ${resDup.status}`);
  if (resDup.status === 200 && dupText.includes("duplicate_ignored")) {
    console.log("- Duplicate correctly ignored safely");
  } else {
    console.error("FAIL: Duplicate was not handled gracefully", dupText);
    process.exit(1);
  }

  console.log("\n4. Testing Invalid Signature");
  const headersInvalid = { ...headers, 'X-ZECA-Signature': 'invalid_hash_abc' };
  const resInv = await fetch(functionUrl, { method: 'POST', headers: headersInvalid, body: payloadString });
  console.log(`- Invalid Signature HTTP Status: ${resInv.status}`);
  if (resInv.status === 401) {
    console.log("- Invalid signature correctly blocked (401)");
  } else {
    console.error("FAIL: Invalid signature didn't return 401");
    process.exit(1);
  }

  console.log("\n=== SUCCESS: Zalo Receiver Smoke Test PASS ===");

  if (process.env.KEEP_QA_DATA !== 'true') {
    await cleanup();
  }
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
