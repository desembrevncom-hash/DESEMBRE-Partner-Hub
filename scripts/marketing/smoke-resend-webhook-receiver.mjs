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
const RESEND_WEBHOOK_SECRET = env.RESEND_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_WEBHOOK_SECRET) {
  console.error("Missing required env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_WEBHOOK_SECRET) in .env.staging");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const QA_PREFIX = 'qa-m10c-resend-';
const MOCK_EVENT_ID = `${QA_PREFIX}${crypto.randomUUID()}`;
const MOCK_MSG_ID = `${QA_PREFIX}msg-${Date.now()}`;

async function cleanup() {
  console.log("\n[Cleanup] Removing qa-m10c-resend-* data...");
  const { data: events } = await supabaseAdmin
    .from("webhook_events")
    .delete()
    .like('dedupe_key', `${QA_PREFIX}%`)
    .select('id');
  console.log(`- webhook_events cleaned: ${events?.length || 0} rows`);
}

async function run() {
  console.log("=== START: Smoke Test Resend Webhook Receiver ===");

  if (process.env.KEEP_QA_DATA !== 'true') {
    await cleanup();
  }

  const payload = {
    type: "email.delivered",
    data: {
      email_id: MOCK_MSG_ID,
      to: ["qa-m10c@example.com"]
    }
  };
  const payloadString = JSON.stringify(payload);

  // Generate Svix Signature
  const base64Secret = RESEND_WEBHOOK_SECRET.startsWith('whsec_') ? RESEND_WEBHOOK_SECRET.substring(6) : RESEND_WEBHOOK_SECRET;
  const secretBytes = Buffer.from(base64Secret, 'base64');
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const toSign = `${MOCK_EVENT_ID}.${timestamp}.${payloadString}`;
  const signature = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

  const headers = {
    'Content-Type': 'application/json',
    'svix-id': MOCK_EVENT_ID,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`
  };

  const functionUrl = `${SUPABASE_URL}/functions/v1/resend-webhook`;
  
  console.log(`\n1. Sending valid webhook to ${functionUrl}`);
  console.log(`- event_id (svix-id): ${MOCK_EVENT_ID}`);
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
  // The dedupe_key is the svix_id
  const { data: dbEvent, error } = await supabaseAdmin
    .from("webhook_events")
    .select("*")
    .eq('dedupe_key', MOCK_EVENT_ID)
    .single();

  if (error || !dbEvent) {
    console.error("FAIL: Could not find the event in webhook_events");
    console.error(error);
    process.exit(1);
  }

  console.log(`- Found row in webhook_events (id: ${dbEvent.id})`);
  console.assert(dbEvent.provider === 'resend', "Provider should be resend");
  console.assert(dbEvent.event_type === 'email.delivered', "Event type should match");
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
  const headersInvalid = { ...headers, 'svix-signature': 'v1,invalid_hash' };
  const resInv = await fetch(functionUrl, { method: 'POST', headers: headersInvalid, body: payloadString });
  console.log(`- Invalid Signature HTTP Status: ${resInv.status}`);
  if (resInv.status === 401) {
    console.log("- Invalid signature correctly blocked (401)");
  } else {
    console.error("FAIL: Invalid signature didn't return 401");
    process.exit(1);
  }

  console.log("\n=== SUCCESS: Resend Receiver Smoke Test PASS ===");

  if (process.env.KEEP_QA_DATA !== 'true') {
    await cleanup();
  }
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
