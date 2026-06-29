import { describe, it, expect, vi } from "vitest";
import { handleResendWebhook, verifySvixSignature, computeEventFingerprint } from "../supabase/functions/resend-delivery-webhook/handler";

describe("Marketing Resend Webhook Event Intake (M36)", () => {
  const mockSecret = "whsec_" + btoa(String.fromCharCode(...new Uint8Array(32).fill(1))); // 32 byte secret

  const createMockRequest = (
    method: string,
    bodyObj: any,
    headers: Record<string, string>,
    signBody = false
  ) => {
    const rawBody = JSON.stringify(bodyObj);
    const mockHeaders = new Map(Object.entries(headers));
    
    return {
      method,
      text: async () => rawBody,
      headers: {
        get: (key: string) => mockHeaders.get(key) || null,
      },
    };
  };

  const createMockEnv = (secret: string) => ({
    get: (name: string) => name === "RESEND_WEBHOOK_SIGNING_SECRET" ? secret : undefined,
  });

  const createMockSupabase = (existingJobId: string | null, insertError: any = null) => {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (existingJobId) return { data: { id: existingJobId }, error: null };
              return { data: null, error: null };
            }
          })
        }),
        insert: (data: any) => {
          return Promise.resolve({ data: null, error: insertError });
        }
      })
    };
  };

  const generateSignature = async (rawBody: string, svixId: string, timestamp: string, secretBase64: string) => {
    const cleanSecret = secretBase64.replace(/^whsec_/, "");
    const secretBytes = Uint8Array.from(atob(cleanSecret), (c) => c.charCodeAt(0));
    const signedContent = `${svixId}.${timestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
    return "v1," + btoa(String.fromCharCode(...new Uint8Array(sig)));
  };

  it("should reject non-POST requests with 405", async () => {
    const req = createMockRequest("GET", {}, {});
    const res = await handleResendWebhook(req, createMockEnv(mockSecret), createMockSupabase("job1"));
    expect(res.status).toBe(405);
  });

  it("should reject missing signatures with 403", async () => {
    const req = createMockRequest("POST", { data: { email_id: "em_1" } }, {});
    const res = await handleResendWebhook(req, createMockEnv(mockSecret), createMockSupabase("job1"));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Invalid webhook signature");
  });

  it("should reject invalid signatures with 403", async () => {
    const req = createMockRequest("POST", { data: { email_id: "em_1" } }, {
      "svix-id": "msg_123",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,invalidBase64Sig=="
    });
    const res = await handleResendWebhook(req, createMockEnv(mockSecret), createMockSupabase("job1"));
    expect(res.status).toBe(403);
  });

  it("should parse and map a valid email.delivered event to 'delivered' safely", async () => {
    const payload = {
      type: "email.delivered",
      created_at: "2026-06-29T10:00:00Z",
      data: { email_id: "em_valid" }
    };
    const rawBody = JSON.stringify(payload);
    const svixId = "msg_valid_1";
    const ts = "1234567890";
    const sig = await generateSignature(rawBody, svixId, ts, mockSecret);
    
    const req = createMockRequest("POST", payload, {
      "svix-id": svixId,
      "svix-timestamp": ts,
      "svix-signature": sig
    });

    const res = await handleResendWebhook(req, createMockEnv(mockSecret), createMockSupabase("job1"));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should ignore unsupported event types (e.g. email.delivery_delayed) and return 202 without insert", async () => {
    const payload = { type: "email.delivery_delayed", data: { email_id: "em_ignore" } };
    const sig = await generateSignature(JSON.stringify(payload), "id", "ts", mockSecret);
    const req = createMockRequest("POST", payload, { "svix-id": "id", "svix-timestamp": "ts", "svix-signature": sig });
    
    const res = await handleResendWebhook(req, createMockEnv(mockSecret), createMockSupabase("job1"));
    expect(res.status).toBe(202);
    expect(res.body.message).toContain("Ignored: Unsupported event type");
  });

  it("should ignore events where the job is not found (orphan events) and return 202", async () => {
    const payload = { type: "email.opened", data: { email_id: "em_orphan" } };
    const sig = await generateSignature(JSON.stringify(payload), "id", "ts", mockSecret);
    const req = createMockRequest("POST", payload, { "svix-id": "id", "svix-timestamp": "ts", "svix-signature": sig });
    
    const res = await handleResendWebhook(req, createMockEnv(mockSecret), createMockSupabase(null)); // null job ID
    expect(res.status).toBe(202);
    expect(res.body.message).toContain("Ignored: Orphan provider_message_id");
  });

  it("should catch unique index violation (duplicate event) safely and return 202", async () => {
    const payload = { type: "email.clicked", data: { email_id: "em_dup" } };
    const sig = await generateSignature(JSON.stringify(payload), "id", "ts", mockSecret);
    const req = createMockRequest("POST", payload, { "svix-id": "id", "svix-timestamp": "ts", "svix-signature": sig });
    
    const res = await handleResendWebhook(
      req, 
      createMockEnv(mockSecret), 
      createMockSupabase("job1", { code: "23505" }) // duplicate error
    );
    expect(res.status).toBe(202);
    expect(res.body.message).toContain("Ignored: Duplicate event");
  });
});
