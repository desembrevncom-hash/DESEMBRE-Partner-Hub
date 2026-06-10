import crypto from "crypto";

const WEBHOOK_URL = "https://wmhfvggbthyikqvlyqup.supabase.co/functions/v1/fb-messenger-webhook";

// ⚠️ IMPORTANT: Replace these with your actual Staging secrets before running this script
const META_WEBHOOK_VERIFY_TOKEN = "desembre_fb_webhook_staging_2026_x7Kp92";
const META_APP_SECRET = "7e2ea11f6c100f9b72a781d28ddf0066";

// Helper to generate HMAC SHA256 signature
function generateSignature(payload: string): string {
  const hmac = crypto.createHmac("sha256", META_APP_SECRET);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

async function runTests() {
  console.log("=== Webhook Local Tests ===");

  // 1. Test GET verify success
  console.log("\n[1] Testing GET Verify (Success)...");
  try {
    const res = await fetch(`${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${META_WEBHOOK_VERIFY_TOKEN}&hub.challenge=CHALLENGE_ACCEPTED`);
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
    if (res.status === 200 && text === "CHALLENGE_ACCEPTED") {
      console.log("✅ GET verify success passed.");
    } else {
      console.log("❌ GET verify success failed.");
    }
  } catch (e) {
    console.error(e);
  }

  // 2. Test GET verify fail
  console.log("\n[2] Testing GET Verify (Invalid Token)...");
  try {
    const res = await fetch(`${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=CHALLENGE_ACCEPTED`);
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    if (res.status === 403) {
      console.log("✅ GET verify invalid token passed.");
    } else {
      console.log("❌ GET verify invalid token failed.");
    }
  } catch (e) {
    console.error(e);
  }

  // 3. Test POST invalid signature
  console.log("\n[3] Testing POST (Invalid Signature)...");
  try {
    const payload = JSON.stringify({ object: "page", entry: [] });
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": "sha256=invalid_signature_hex_here"
      },
      body: payload
    });
    console.log(`Status: ${res.status}`);
    if (res.status === 401) {
      console.log("✅ POST invalid signature passed.");
    } else {
      console.log("❌ POST invalid signature failed.");
    }
  } catch (e) {
    console.error(e);
  }

  // 4. Test POST valid payload (requires supabase local to work fully for DB insert, but we can verify it accepts the payload)
  console.log("\n[4] Testing POST (Valid Signature)...");
  try {
    const payload = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "page_123",
          time: 1620000000,
          messaging: [
            {
              sender: { id: "psid_456" },
              recipient: { id: "page_123" },
              timestamp: 1620000000,
              message: { text: "Hello from test!" }
            }
          ]
        }
      ]
    });
    
    const signature = generateSignature(payload);
    
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature
      },
      body: payload
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text}`);
    if (res.status === 200 && text === "EVENT_RECEIVED") {
      console.log("✅ POST valid signature passed.");
    } else {
      console.log("❌ POST valid signature failed.");
    }
  } catch (e) {
    console.error(e);
  }
}

runTests();
