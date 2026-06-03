import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

async function decryptToken(encrypted: string, keyHex: string): Promise<string | null> {
  try {
    const [ivHex, ciphertextB64] = encrypted.split(":");
    if (!ivHex || !ciphertextB64) return null;
    const keyBytes = hexToBytes(keyHex.padEnd(64, "0").slice(0, 64));
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
      "decrypt",
    ]);
    const iv = hexToBytes(ivHex);
    const ciphertext = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

function formatPhoneForZalo(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "84" + cleaned.slice(1);
  if (!cleaned.startsWith("84")) cleaned = "84" + cleaned;
  return cleaned;
}

function getMissingParams(required: string[], payload: Record<string, any>): string[] {
  if (!required || !Array.isArray(required)) return [];
  return required.filter(
    (p) => payload[p] === undefined || payload[p] === null || payload[p] === "",
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Auth Check (must be admin or use service key directly for internal processing)
  const authHeader = req.headers.get("Authorization");
  const internalKey = req.headers.get("X-Internal-Key");
  const expectedInternalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") || "";

  const isInternalCall = internalKey && internalKey === expectedInternalKey;

  if (!isInternalCall && !authHeader) {
    return new Response(JSON.stringify({ success: false, error: "Thiếu Authorization" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  if (!isInternalCall && authHeader) {
    const {
      data: { user },
    } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user)
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = roleData?.role === "admin" || roleData?.role === "sub_admin";
    if (!isAdmin)
      return new Response(
        JSON.stringify({ success: false, error: "Chỉ Admin/SubAdmin mới có thể process retry" }),
        { status: 403, headers: corsHeaders },
      );
  }

  // 2. Pick pending retries
  const now = new Date().toISOString();
  const { data: pendingRetries, error: fetchErr } = await adminClient
    .from("marketing_retry_queue")
    .select("*")
    .eq("status", "pending")
    .lte("next_retry_at", now)
    .order("next_retry_at", { ascending: true })
    .limit(10); // Process max 10 at a time

  if (fetchErr)
    return new Response(JSON.stringify({ success: false, error: fetchErr.message }), {
      headers: corsHeaders,
    });

  if (!pendingRetries || pendingRetries.length === 0) {
    return new Response(
      JSON.stringify({ success: true, processed: 0, message: "Không có retry nào cần xử lý" }),
      { headers: corsHeaders },
    );
  }

  const results = [];
  const encKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || serviceKey;

  for (const retry of pendingRetries) {
    // Mark as retrying
    await adminClient
      .from("marketing_retry_queue")
      .update({ status: "retrying", updated_at: new Date().toISOString() })
      .eq("id", retry.id);

    const newCount = retry.retry_count + 1;

    try {
      // Load current sender token
      const { data: tokenRow } = await adminClient
        .from("sender_account_tokens")
        .select("*")
        .eq("sender_account_id", retry.sender_account_id)
        .maybeSingle();

      if (!tokenRow?.access_token_enc) throw new Error("No token found");

      const isExpired = Date.now() > new Date(tokenRow.token_expires_at).getTime() - 5 * 60 * 1000;
      let accessToken: string | null = null;

      if (isExpired) {
        const refreshRes = await fetch(`${supabaseUrl}/functions/v1/refresh-zalo-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Key": expectedInternalKey },
          body: JSON.stringify({ sender_account_id: retry.sender_account_id }),
        });
        const refreshData = await refreshRes.json();
        if (!refreshData.success) throw new Error("Token refresh failed: " + refreshData.error);
        const { data: newRow } = await adminClient
          .from("sender_account_tokens")
          .select("access_token_enc")
          .eq("sender_account_id", retry.sender_account_id)
          .maybeSingle();
        if (newRow?.access_token_enc)
          accessToken = await decryptToken(newRow.access_token_enc, encKey);
      } else {
        accessToken = await decryptToken(tokenRow.access_token_enc, encKey);
      }

      if (!accessToken) throw new Error("Could not decrypt access token");

      // Load template
      const { data: template } = await adminClient
        .from("zns_templates")
        .select("zalo_template_id, template_name, required_params")
        .eq("id", retry.zns_template_id)
        .maybeSingle();
      if (!template) throw new Error("Template not found");

      // Load customer phone
      const { data: customer } = await adminClient
        .from("customers")
        .select("phone")
        .eq("id", retry.customer_id)
        .maybeSingle();
      if (!customer?.phone) throw new Error("Customer phone missing");

      // Validate params
      const missing = getMissingParams(template.required_params || [], retry.payload);
      if (missing.length > 0) throw new Error(`Missing params: ${missing.join(", ")}`);

      // Call Zalo
      const formattedPhone = formatPhoneForZalo(customer.phone);
      const znsRes = await fetch("https://business.openapi.zalo.me/message/template", {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: accessToken },
        body: JSON.stringify({
          phone: formattedPhone,
          template_id: template.zalo_template_id,
          template_data: retry.payload,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const znsResult = await znsRes.json();

      if (znsResult.error !== 0)
        throw new Error(`Zalo error ${znsResult.error}: ${znsResult.message}`);

      // Success — update queue and log
      await adminClient
        .from("marketing_retry_queue")
        .update({
          status: "succeeded",
          retry_count: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", retry.id);
      if (retry.delivery_log_id) {
        await adminClient
          .from("marketing_delivery_logs")
          .update({
            status: "sent",
            retry_count: newCount,
            last_retry_at: new Date().toISOString(),
            provider_message_id: znsResult.data?.message_id,
            provider_response: znsResult,
          })
          .eq("id", retry.delivery_log_id);
      }
      await adminClient.from("sender_action_logs").insert({
        action: "zns_retry_processed",
        sender_type: "business",
        result: "sent",
        note: `Retry #${newCount} succeeded`,
      });
      results.push({ id: retry.id, status: "succeeded", attempt: newCount });
    } catch (err: any) {
      // Check if we've hit max retries
      if (newCount >= retry.max_retries) {
        await adminClient
          .from("marketing_retry_queue")
          .update({
            status: "abandoned",
            retry_count: newCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", retry.id);
        if (retry.delivery_log_id) {
          await adminClient
            .from("marketing_delivery_logs")
            .update({
              status: "abandoned",
              retry_count: newCount,
              last_retry_at: new Date().toISOString(),
            })
            .eq("id", retry.delivery_log_id);
        }
        await adminClient.from("sender_action_logs").insert({
          action: "zns_retry_abandoned",
          sender_type: "business",
          result: "abandoned",
          note: `After ${newCount} attempts: ${err.message}`,
        });
        results.push({ id: retry.id, status: "abandoned", attempt: newCount });
      } else {
        // Re-queue with backoff
        const backoffMinutes = [5, 15, 45, 120][newCount] ?? 120;
        const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
        await adminClient
          .from("marketing_retry_queue")
          .update({
            status: "pending",
            retry_count: newCount,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq("id", retry.id);
        if (retry.delivery_log_id) {
          await adminClient
            .from("marketing_delivery_logs")
            .update({
              status: "retrying",
              retry_count: newCount,
              last_retry_at: new Date().toISOString(),
            })
            .eq("id", retry.delivery_log_id);
        }
        results.push({
          id: retry.id,
          status: "requeued",
          attempt: newCount,
          next_retry: nextRetry,
        });
      }
    }
  }

  return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
    headers: corsHeaders,
  });
});
