import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Error Code Constants ──────────────────────────────────────────────────────
type ZnsErrorCode =
  | "TOKEN_EXPIRED"
  | "TOKEN_REFRESH_FAILED"
  | "INVALID_TEMPLATE"
  | "MISSING_PHONE"
  | "INVALID_PHONE"
  | "MISSING_PARAMS"
  | "OPT_OUT_BLOCKED"
  | "SENDER_UNHEALTHY"
  | "SENDER_DEGRADED"
  | "FORBIDDEN_ROLE"
  | "RATE_LIMIT"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_5XX"
  | "PROVIDER_REJECTED"
  | "DUPLICATE_BLOCKED"
  | "UNKNOWN_PROVIDER_ERROR";

const RETRYABLE_CODES = new Set([
  "RATE_LIMIT",
  "PROVIDER_TIMEOUT",
  "PROVIDER_5XX",
  "TOKEN_REFRESH_FAILED",
]);

function mapZaloError(code: number, msg?: string): ZnsErrorCode {
  switch (code) {
    case -201:
    case -202:
      return "TOKEN_EXPIRED";
    case -100:
      return "INVALID_TEMPLATE";
    case -124:
      return "INVALID_PHONE";
    case -106:
      return "RATE_LIMIT";
    case -97:
      return "PROVIDER_REJECTED";
    default:
      if (code >= 500) return "PROVIDER_5XX";
      if (msg?.toLowerCase().includes("timeout")) return "PROVIDER_TIMEOUT";
      return "UNKNOWN_PROVIDER_ERROR";
  }
}

// ── Crypto helpers ────────────────────────────────────────────────────────────
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

// ── Dedupe key hash ───────────────────────────────────────────────────────────
async function buildDedupeKey(
  customerId: string,
  templateId: string,
  payload: Record<string, any>,
): Promise<string> {
  const raw = `${customerId}:${templateId}:${JSON.stringify(payload, Object.keys(payload).sort())}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function getMissingParams(required: string[], payload: Record<string, any>): string[] {
  if (!required || !Array.isArray(required)) return [];
  return required.filter(
    (p) => payload[p] === undefined || payload[p] === null || payload[p] === "",
  );
}

function formatPhoneForZalo(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "84" + cleaned.slice(1);
  if (!cleaned.startsWith("84")) cleaned = "84" + cleaned;
  return cleaned;
}

// ── Helper: Log delivery ──────────────────────────────────────────────────────
async function logDelivery(
  client: any,
  p: {
    customer_id: string;
    sender_account_id: string;
    zns_template_id: string;
    status: string;
    reason?: string;
    normalized_error_code?: string;
    provider_msg_id?: string;
    user_id: string;
    dedupe_key?: string;
    provider_response?: any;
    retry_count?: number;
  },
): Promise<string | null> {
  const { data } = await client
    .from("marketing_delivery_logs")
    .insert({
      customer_id: p.customer_id,
      sender_account_id: p.sender_account_id,
      zns_template_id: p.zns_template_id,
      channel: "zns",
      mode: "provider_send",
      status: p.status,
      reason: p.reason,
      normalized_error_code: p.normalized_error_code,
      provider_message_id: p.provider_msg_id,
      created_by: p.user_id,
      dedupe_key: p.dedupe_key,
      provider_response: p.provider_response,
      retry_count: p.retry_count ?? 0,
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

// ── Helper: Queue retry ───────────────────────────────────────────────────────
async function queueRetry(
  client: any,
  logId: string,
  p: {
    customer_id: string;
    zns_template_id: string;
    sender_account_id: string;
    payload: any;
    error_code: ZnsErrorCode;
    retry_count?: number;
  },
) {
  const retryCount = p.retry_count ?? 0;
  const maxRetries = 3;
  if (retryCount >= maxRetries) return; // Never exceed max

  // Exponential backoff: 5m, 15m, 45m
  const backoffMinutes = [5, 15, 45][retryCount] ?? 60;
  const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

  await client.from("marketing_retry_queue").insert({
    delivery_log_id: logId,
    customer_id: p.customer_id,
    zns_template_id: p.zns_template_id,
    sender_account_id: p.sender_account_id,
    payload: p.payload,
    retry_reason: p.error_code,
    normalized_error_code: p.error_code,
    retry_count: retryCount,
    max_retries: maxRetries,
    next_retry_at: nextRetryAt,
    status: "pending",
  });
}

// ── Helper: Circuit breaker ───────────────────────────────────────────────────
async function checkAndTripCircuitBreaker(
  client: any,
  senderId: string,
  newErrorCode: ZnsErrorCode,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { count } = await client
    .from("marketing_delivery_logs")
    .select("*", { count: "exact", head: true })
    .eq("sender_account_id", senderId)
    .eq("channel", "zns")
    .eq("status", "failed")
    .gte("created_at", windowStart);

  const failureCount = count ?? 0;

  if (failureCount >= 9) {
    // 10 including the current one
    // Trip the circuit breaker
    await client
      .from("sender_accounts")
      .update({
        health_status: "degraded",
        last_error: `Circuit breaker tripped: ${failureCount + 1} failures in 15 minutes`,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", senderId);

    // Audit log
    await client.from("sender_action_logs").insert({
      action: "sender_degraded",
      sender_type: "business",
      result: "degraded",
      note: `Circuit breaker tripped after ${failureCount + 1} ZNS failures in 15 min. Last error: ${newErrorCode}`,
    });

    return true; // Tripped
  }

  return false; // OK
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Auth + Role
  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response(JSON.stringify({ allowed: false, reason: "Thiếu Authorization" }), {
      status: 401,
      headers: corsHeaders,
    });

  const {
    data: { user },
    error: authErr,
  } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user)
    return new Response(JSON.stringify({ allowed: false, reason: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });

  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdminOrSubAdmin = roleData?.role === "admin" || roleData?.role === "sub_admin";

  // 2. Parse Body
  let body: {
    customer_id: string;
    zns_template_id: string;
    template_data: Record<string, any>;
    mode: "validate_only" | "provider_send";
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ allowed: false, reason: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { customer_id, zns_template_id, template_data = {}, mode = "validate_only" } = body;

  if (mode === "provider_send" && !isAdminOrSubAdmin) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Chỉ Admin/SubAdmin mới được gửi ZNS",
        reason_code: "FORBIDDEN_ROLE",
      }),
      { status: 403, headers: corsHeaders },
    );
  }

  // 3. Load Customer
  const { data: customer } = await adminClient
    .from("customers")
    .select("id, name, phone, marketing_opt_out_at")
    .eq("id", customer_id)
    .maybeSingle();
  if (!customer)
    return new Response(JSON.stringify({ allowed: false, reason: "Khách hàng không tồn tại" }), {
      status: 404,
      headers: corsHeaders,
    });

  if (!customer.phone) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Khách hàng chưa có số điện thoại",
        reason_code: "MISSING_PHONE",
      }),
      { headers: corsHeaders },
    );
  }
  if (customer.marketing_opt_out_at) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Khách hàng đã từ chối nhận tin",
        reason_code: "OPT_OUT_BLOCKED",
      }),
      { headers: corsHeaders },
    );
  }

  // 4. Load Template + Sender
  const { data: template } = await adminClient
    .from("zns_templates")
    .select(
      "id, zalo_template_id, template_name, required_params, is_active, sender_account_id, sender:sender_accounts (id, is_active, health_status, name)",
    )
    .eq("id", zns_template_id)
    .maybeSingle();

  if (!template)
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "ZNS Template không tồn tại",
        reason_code: "INVALID_TEMPLATE",
      }),
      { headers: corsHeaders },
    );
  if (!template.is_active)
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Template đang bị vô hiệu hóa",
        reason_code: "INVALID_TEMPLATE",
      }),
      { headers: corsHeaders },
    );

  const sender = Array.isArray(template.sender) ? template.sender[0] : template.sender;
  if (!sender)
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Không tìm thấy Sender",
        reason_code: "SENDER_UNHEALTHY",
      }),
      { headers: corsHeaders },
    );

  if (sender.health_status === "degraded") {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Tài khoản gửi đang bị hạn chế (Circuit Breaker kích hoạt)",
        reason_code: "SENDER_DEGRADED",
      }),
      { headers: corsHeaders },
    );
  }
  if (!sender.is_active || !["healthy"].includes(sender.health_status)) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: `Tài khoản gửi đang gặp lỗi (${sender.health_status})`,
        reason_code: "SENDER_UNHEALTHY",
      }),
      { headers: corsHeaders },
    );
  }

  // 5. Validate Required Params
  const missing = getMissingParams(template.required_params || [], template_data);
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: `Thiếu tham số: ${missing.join(", ")}`,
        reason_code: "MISSING_PARAMS",
        missing_params: missing,
      }),
      { headers: corsHeaders },
    );
  }

  // 6. Validate Only — Return early
  if (mode === "validate_only") {
    return new Response(
      JSON.stringify({ allowed: true, preview_phone: formatPhoneForZalo(customer.phone) }),
      { headers: corsHeaders },
    );
  }

  // ── PROVIDER SEND ───────────────────────────────────────────────────────────

  // 7. Safe env gates
  const globalKillSwitch = Deno.env.get("MARKETING_PRODUCTION_SENDING_ENABLED");
  if (globalKillSwitch !== "true") {
    // Log failure
    await logDelivery(adminClient, {
      customer_id,
      sender_account_id: sender.id,
      zns_template_id,
      status: "failed",
      reason: "production_sending_disabled",
      normalized_error_code: "production_sending_disabled",
      user_id: user.id,
    });
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Production sending is disabled",
        reason_code: "provider_disabled",
        step: "global_kill_switch",
      }),
      { headers: corsHeaders },
    );
  }

  const providerSendEnabled = Deno.env.get("MARKETING_PROVIDER_SEND_ENABLED") === "true";
  if (!providerSendEnabled) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Gửi ZNS thật đang bị tắt (MARKETING_PROVIDER_SEND_ENABLED=false)",
        reason_code: "provider_disabled",
      }),
      { headers: corsHeaders },
    );
  }

  // 8. Duplicate Protection
  const dedupeKey = await buildDedupeKey(customer_id, zns_template_id, template_data);
  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: dupeCheck } = await adminClient
    .from("marketing_delivery_logs")
    .select("id, status")
    .eq("dedupe_key", dedupeKey)
    .in("status", ["sent", "sending", "retrying", "delivered"])
    .gte("created_at", windowStart)
    .limit(1)
    .maybeSingle();

  if (dupeCheck) {
    // Log the blocked duplicate attempt
    const logId = await logDelivery(adminClient, {
      customer_id,
      sender_account_id: sender.id,
      zns_template_id,
      status: "duplicate_blocked",
      reason: `Tin trùng lặp với log ${dupeCheck.id}`,
      normalized_error_code: "DUPLICATE_BLOCKED",
      user_id: user.id,
      dedupe_key: dedupeKey,
    });
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Tin tương tự đã được gửi hoặc đang xử lý gần đây.",
        reason_code: "DUPLICATE_BLOCKED",
        existing_log_id: dupeCheck.id,
        delivery_log_id: logId,
      }),
      { headers: corsHeaders },
    );
  }

  // 9. Load + Decrypt Zalo Token
  const { data: tokenRow } = await adminClient
    .from("sender_account_tokens")
    .select("*")
    .eq("sender_account_id", sender.id)
    .maybeSingle();
  if (!tokenRow?.access_token_enc) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Không tìm thấy token Zalo",
        reason_code: "TOKEN_EXPIRED",
      }),
      { headers: corsHeaders },
    );
  }

  const encKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || serviceKey;
  let accessToken: string | null = null;
  const isExpired = Date.now() > new Date(tokenRow.token_expires_at).getTime() - 5 * 60 * 1000;

  if (isExpired) {
    try {
      const internalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") || "";
      const refreshRes = await fetch(`${supabaseUrl}/functions/v1/refresh-zalo-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": internalKey },
        body: JSON.stringify({ sender_account_id: sender.id }),
      });
      const refreshData = await refreshRes.json();
      if (!refreshData.success) throw new Error(refreshData.error);
      const { data: newRow } = await adminClient
        .from("sender_account_tokens")
        .select("access_token_enc")
        .eq("sender_account_id", sender.id)
        .maybeSingle();
      if (newRow?.access_token_enc)
        accessToken = await decryptToken(newRow.access_token_enc, encKey);
    } catch (e: any) {
      const errCode: ZnsErrorCode = "TOKEN_REFRESH_FAILED";
      // Insert log first to get ID for retry queue
      const { data: logData } = await adminClient
        .from("marketing_delivery_logs")
        .insert({
          customer_id,
          sender_account_id: sender.id,
          zns_template_id,
          channel: "zns",
          mode: "provider_send",
          status: "failed",
          reason: `Refresh token thất bại: ${e.message}`,
          normalized_error_code: errCode,
          created_by: user.id,
          dedupe_key: dedupeKey,
        })
        .select("id")
        .maybeSingle();
      if (logData?.id && RETRYABLE_CODES.has(errCode)) {
        await queueRetry(adminClient, logData.id, {
          customer_id,
          zns_template_id,
          sender_account_id: sender.id,
          payload: template_data,
          error_code: errCode,
        });
      }
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: `Lỗi refresh token: ${e.message}`,
          reason_code: errCode,
          delivery_log_id: logData?.id,
        }),
        { headers: corsHeaders },
      );
    }
  } else {
    accessToken = await decryptToken(tokenRow.access_token_enc, encKey);
  }

  if (!accessToken) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Không thể giải mã Zalo token",
        reason_code: "TOKEN_EXPIRED",
      }),
      { headers: corsHeaders },
    );
  }

  // 10. Call Zalo ZNS API
  try {
    const formattedPhone = formatPhoneForZalo(customer.phone);
    const znsRes = await fetch("https://business.openapi.zalo.me/message/template", {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: accessToken },
      body: JSON.stringify({
        phone: formattedPhone,
        template_id: template.zalo_template_id,
        template_data,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const znsResult = await znsRes.json();

    if (znsResult.error !== 0) {
      const errCode = mapZaloError(znsResult.error, znsResult.message);
      const tripped = await checkAndTripCircuitBreaker(adminClient, sender.id, errCode);
      const { data: logData } = await adminClient
        .from("marketing_delivery_logs")
        .insert({
          customer_id,
          sender_account_id: sender.id,
          zns_template_id,
          channel: "zns",
          mode: "provider_send",
          status: "failed",
          reason: `Zalo API Error ${znsResult.error}: ${znsResult.message}`,
          normalized_error_code: errCode,
          created_by: user.id,
          dedupe_key: dedupeKey,
          provider_response: znsResult,
        })
        .select("id")
        .maybeSingle();

      if (logData?.id && RETRYABLE_CODES.has(errCode) && !tripped) {
        await queueRetry(adminClient, logData.id, {
          customer_id,
          zns_template_id,
          sender_account_id: sender.id,
          payload: template_data,
          error_code: errCode,
        });
        await adminClient.from("sender_action_logs").insert({
          action: "zns_retry_created",
          sender_type: "business",
          result: "queued",
          note: `Retry queued for error ${errCode}`,
        });
      }
      await adminClient.from("sender_action_logs").insert({
        action: "zns_send_failed",
        sender_type: "business",
        result: "failed",
        note: `Error ${errCode}`,
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          reason: `Zalo API: ${znsResult.message}`,
          reason_code: errCode,
          tripped_circuit_breaker: tripped,
          delivery_log_id: logData?.id,
        }),
        { headers: corsHeaders },
      );
    }

    // Success
    const msgId = znsResult.data?.message_id || znsResult.data?.msg_id;
    const { data: logData } = await adminClient
      .from("marketing_delivery_logs")
      .insert({
        customer_id,
        sender_account_id: sender.id,
        zns_template_id,
        channel: "zns",
        mode: "provider_send",
        status: "sent",
        provider_message_id: msgId,
        created_by: user.id,
        dedupe_key: dedupeKey,
        provider_response: znsResult,
        delivery_metadata: { phone: formattedPhone },
      })
      .select("id")
      .maybeSingle();

    await adminClient.from("customer_activities").insert({
      customer_id,
      activity_type: "marketing_template_used",
      title: "Đã gửi ZNS",
      description: `Gửi ZNS "${template.template_name}" thành công qua OA ${sender.name}.`,
      performed_by: user.id,
      metadata: { zns_template_id, zalo_message_id: msgId },
    });
    await adminClient.rpc("increment_sender_usage", { p_sender_id: sender.id });

    return new Response(
      JSON.stringify({ allowed: true, message_id: msgId, delivery_log_id: logData?.id }),
      { headers: corsHeaders },
    );
  } catch (err: any) {
    const errCode: ZnsErrorCode =
      err.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "UNKNOWN_PROVIDER_ERROR";
    const tripped = await checkAndTripCircuitBreaker(adminClient, sender.id, errCode);
    const { data: logData } = await adminClient
      .from("marketing_delivery_logs")
      .insert({
        customer_id,
        sender_account_id: sender.id,
        zns_template_id,
        channel: "zns",
        mode: "provider_send",
        status: "failed",
        reason: `Network error: ${err.message}`,
        normalized_error_code: errCode,
        created_by: user.id,
        dedupe_key: dedupeKey,
      })
      .select("id")
      .maybeSingle();
    if (logData?.id && RETRYABLE_CODES.has(errCode) && !tripped) {
      await queueRetry(adminClient, logData.id, {
        customer_id,
        zns_template_id,
        sender_account_id: sender.id,
        payload: template_data,
        error_code: errCode,
      });
    }
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "Lỗi kết nối Zalo API",
        reason_code: errCode,
        delivery_log_id: logData?.id,
      }),
      { headers: corsHeaders },
    );
  }
});
