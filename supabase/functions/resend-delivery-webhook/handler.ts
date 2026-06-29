// Standalone Svix webhook verification using Web Crypto API to ensure max compatibility
// across Deno Edge Functions and Node/Vitest without external module dependencies.

export async function verifySvixSignature(
  rawBody: string,
  headers: Record<string, string | null>,
  secretBase64: string
): Promise<boolean> {
  try {
    const svixId = headers["svix-id"];
    const svixTimestamp = headers["svix-timestamp"];
    const svixSignature = headers["svix-signature"];

    if (!svixId || !svixTimestamp || !svixSignature || !secretBase64) {
      return false;
    }

    // svix signature secret is a base64 encoded string with "whsec_" prefix (sometimes without)
    const cleanSecret = secretBase64.replace(/^whsec_/, "");
    // Decode base64 secret to raw bytes
    const secretBytes = Uint8Array.from(atob(cleanSecret), (c) => c.charCodeAt(0));

    // Compute expected signature
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedContent)
    );
    
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // svix-signature header can contain multiple space-separated versions (e.g. v1,xyz v1,abc)
    const passedSignatures = svixSignature.split(" ").map((s) => {
      const parts = s.split(",");
      return parts.length === 2 ? parts[1] : s;
    });

    return passedSignatures.includes(expectedSignature);
  } catch (e) {
    return false;
  }
}

export type ValidWebhookEventType = 
  | "sent"
  | "delivered"
  | "bounced"
  | "opened"
  | "clicked"
  | "complained";

export function mapResendEventType(resendType: string): ValidWebhookEventType | null {
  switch (resendType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.complained":
      return "complained";
    default:
      return null;
  }
}

export async function computeEventFingerprint(
  provider: string,
  providerMessageId: string,
  eventType: string,
  occurredAt: string
): Promise<string> {
  const content = `${provider}|${providerMessageId}|${eventType}|${occurredAt}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleResendWebhook(
  req: {
    method: string;
    text: () => Promise<string>;
    headers: { get: (name: string) => string | null };
  },
  env: { get: (name: string) => string | undefined },
  supabaseAdmin: any // Postgres client/Supabase client with admin privileges
): Promise<{ status: number; body: any }> {
  // 1. Require POST only
  if (req.method !== "POST") {
    return { status: 405, body: { error: "Method Not Allowed" } };
  }

  // 2. Read raw body and verify signature
  const rawBody = await req.text();
  const secret = env.get("RESEND_WEBHOOK_SIGNING_SECRET") || "";
  
  const headerMap: Record<string, string | null> = {
    "svix-id": req.headers.get("svix-id"),
    "svix-timestamp": req.headers.get("svix-timestamp"),
    "svix-signature": req.headers.get("svix-signature"),
  };

  const isValid = await verifySvixSignature(rawBody, headerMap, secret);
  if (!isValid) {
    return { status: 403, body: { error: "Invalid webhook signature" } };
  }

  // 3. Parse JSON safely
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return { status: 400, body: { error: "Invalid JSON payload" } };
  }

  const resendEventId = headerMap["svix-id"] || payload.data?.id; // fallback to payload id if svix-id isn't directly usable
  const resendType = payload.type;
  const emailId = payload.data?.email_id;
  const occurredAt = payload.created_at || new Date().toISOString();

  if (!emailId) {
    return { status: 202, body: { message: "Ignored: No email_id found" } };
  }

  // 4. Map event type
  const internalEventType = mapResendEventType(resendType);
  if (!internalEventType) {
    return { status: 202, body: { message: `Ignored: Unsupported event type ${resendType}` } };
  }

  // 5. Match job
  const { data: job, error: jobError } = await supabaseAdmin
    .from("marketing_send_jobs")
    .select("id")
    .eq("provider_message_id", emailId)
    .maybeSingle();

  if (jobError || !job) {
    return { status: 202, body: { message: "Ignored: Orphan provider_message_id" } };
  }

  // 6. Idempotency fallback fingerprint
  const fingerprint = resendEventId 
    ? null 
    : await computeEventFingerprint("resend", emailId, internalEventType, occurredAt);

  // 7. Insert event safely
  const { error: insertError } = await supabaseAdmin
    .from("marketing_send_job_events")
    .insert({
      job_id: job.id,
      event_type: internalEventType,
      provider: "resend",
      provider_message_id: emailId,
      provider_event_id: resendEventId || null,
      event_fingerprint: fingerprint,
      event_data: payload.data || {},
      occurred_at: occurredAt,
    });

  if (insertError) {
    // 8. Handle unique constraint violations gracefully (duplicate webhook)
    if (insertError.code === "23505") { // unique_violation
      return { status: 202, body: { message: "Ignored: Duplicate event" } };
    }
    // For other DB errors, return 500 but log nothing sensitive
    return { status: 500, body: { error: "Database error" } };
  }

  return { status: 200, body: { success: true } };
}
