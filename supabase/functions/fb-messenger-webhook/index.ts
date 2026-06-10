import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const META_WEBHOOK_VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";

// Convert a hex string to a Uint8Array
const hexToU8a = (hex: string) => {
  const u8a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    u8a[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return u8a;
};

// Convert a Uint8Array to a hex string
const u8aToHex = (u8a: Uint8Array) => {
  return Array.prototype.map.call(u8a, x => ('00' + x.toString(16)).slice(-2)).join('');
};

async function verifySignature(payload: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  if (!META_APP_SECRET) {
    return false; // Cannot verify without secret
  }

  const expectedSignatureHex = signatureHeader.replace('sha256=', '');

  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(META_APP_SECRET);
  const dataBuf = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuf = await crypto.subtle.sign("HMAC", cryptoKey, dataBuf);
  const calculatedSignatureHex = u8aToHex(new Uint8Array(signatureBuf));

  // Timing safe compare could be used here, but string equality is acceptable for basic setup
  return calculatedSignatureHex === expectedSignatureHex;
}

serve(async (req) => {
  const url = new URL(req.url);

  // 1. GET Verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    } else {
      console.error("WEBHOOK_VERIFY_FAILED: Token mismatch or invalid mode.");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // 2. POST Event Handling
  if (req.method === "POST") {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    // Verify signature
    const isValid = await verifySignature(rawBody, signature);
    if (!isValid) {
      console.error("Invalid signature. Request rejected.");
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse JSON only after signature verification passes
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse JSON body.");
      return new Response("Bad Request", { status: 400 });
    }

    if (body.object !== "page") {
      return new Response("Not a page event", { status: 404 });
    }

    // Initialize Supabase Service Role client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process entries
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        const events = entry.messaging || [];
        for (const event of events) {
          const senderId = event.sender?.id;
          const recipientId = event.recipient?.id;
          
          if (!senderId || !recipientId) continue; // Skip malformed events

          const timestamp = event.timestamp;
          let messageSnippet = null;
          
          if (event.message?.text) {
            messageSnippet = event.message.text;
          } else if (event.postback?.payload) {
            messageSnippet = `[Postback] ${event.postback.payload}`;
          }

          // Search customer_social_profiles by facebook_page_id + facebook_psid
          const { data: profiles, error: profileErr } = await supabase
            .from("customer_social_profiles")
            .select("customer_id")
            .eq("facebook_page_id", recipientId)
            .eq("facebook_psid", senderId)
            .limit(1);

          let processingStatus = "unlinked";
          let matchedCustomerId = null;

          if (!profileErr && profiles && profiles.length > 0) {
            processingStatus = "matched";
            matchedCustomerId = profiles[0].customer_id;
          }

          // Insert event into facebook_identity_events
          const { error: insertErr } = await supabase
            .from("facebook_identity_events")
            .insert({
              event_type: "messenger_webhook",
              facebook_page_id: recipientId,
              facebook_psid: senderId,
              processing_status: processingStatus,
              matched_customer_id: matchedCustomerId,
              source_payload: {
                ...event,
                _extracted_snippet: messageSnippet
              }
            });

          if (insertErr) {
            console.error("Failed to insert event:", insertErr);
          }
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
