import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Crypto Helpers ────────────────────────────────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Giải mã state AES-GCM đã được mã hóa bởi zalo-oauth-start.
 * Format: ivHex:ciphertextB64
 */
async function decryptState(encrypted: string, keyHex: string): Promise<Record<string, unknown> | null> {
  try {
    const [ivHex, ciphertextB64] = encrypted.split(":");
    if (!ivHex || !ciphertextB64) return null;

    const keyBytes = hexToBytes(keyHex.padEnd(64, "0").slice(0, 64));
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const iv = hexToBytes(ivHex);
    const ciphertext = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

/**
 * Mã hóa token (access/refresh) bằng AES-GCM trước khi lưu DB.
 * Mỗi lần gọi sinh IV mới để đảm bảo ciphertext không bị replay.
 */
async function encryptToken(token: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex.padEnd(64, "0").slice(0, 64));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  return ivHex + ":" + btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
}

// ── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Redirect target mặc định
  const adminRedirectBase = Deno.env.get("APP_URL") || "http://localhost:5173";
  const successRedirect = `${adminRedirectBase}/admin/sender-accounts?connected=zalo`;
  const failRedirect = `${adminRedirectBase}/admin/sender-accounts?connected=error`;

  // ── Xử lý lỗi Zalo trả về (người dùng từ chối) ─────────────────────────────
  if (errorParam || !code || !stateRaw) {
    await adminClient.from("sender_action_logs").insert({
      action: "zalo_oauth_failed",
      sender_id: null,
      sender_type: "business",
      performed_by: null,
      result: "error",
      note: `Zalo OAuth callback lỗi hoặc người dùng hủy — error: ${errorParam || "missing code/state"}`,
    });
    return Response.redirect(`${failRedirect}&reason=${encodeURIComponent(errorParam || "cancelled")}`, 302);
  }

  // ── Giải mã và xác thực state ─────────────────────────────────────────────
  const stateEncKey = Deno.env.get("OAUTH_STATE_SECRET") || supabaseServiceKey;
  const state = await decryptState(decodeURIComponent(stateRaw), stateEncKey);

  if (!state) {
    return Response.redirect(`${failRedirect}&reason=invalid_state`, 302);
  }

  // Kiểm tra TTL 10 phút
  if (typeof state.expires_at === "number" && Date.now() > state.expires_at) {
    return Response.redirect(`${failRedirect}&reason=state_expired`, 302);
  }

  const { user_id, sender_name, app_id, oa_id, code_verifier, redirect_uri } = state as {
    user_id: string;
    sender_name: string;
    app_id: string;
    oa_id: string;
    code_verifier: string;
    redirect_uri: string;
  };

  // ── Lấy App Secret từ env ──────────────────────────────────────────────────
  // Hỗ trợ cấu hình per-app: ZALO_APP_SECRET_{APP_ID} (ưu tiên) hoặc ZALO_APP_SECRET chung
  const appSecretKey = `ZALO_APP_SECRET_${app_id}`;
  const zaloAppSecret =
    Deno.env.get(appSecretKey) || Deno.env.get("ZALO_APP_SECRET") || "";

  if (!zaloAppSecret) {
    await adminClient.from("sender_action_logs").insert({
      action: "zalo_oauth_failed",
      sender_id: null,
      sender_type: "business",
      performed_by: user_id,
      result: "error",
      note: `Thiếu ZALO_APP_SECRET cho App ID: ${app_id}. Vui lòng cấu hình Edge Secret.`,
    });
    return Response.redirect(`${failRedirect}&reason=missing_app_secret`, 302);
  }

  // ── Đổi code lấy access_token + refresh_token ──────────────────────────────
  // Zalo OA v4: POST https://oauth.zaloapp.com/v4/oa/access_token
  // Header: secret_key (App Secret)
  // Body (form-urlencoded): app_id, grant_type, code, code_verifier
  let tokenData: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string | number;
    message?: string;
  };

  try {
    const tokenParams = new URLSearchParams({
      app_id,
      grant_type: "authorization_code",
      code,
      code_verifier,
    });

    const tokenRes = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "secret_key": zaloAppSecret,
      },
      body: tokenParams.toString(),
    });

    tokenData = await tokenRes.json();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown fetch error";
    await adminClient.from("sender_action_logs").insert({
      action: "zalo_oauth_failed",
      sender_type: "business",
      performed_by: user_id,
      result: "error",
      note: `Lỗi kết nối Zalo token endpoint: ${msg}`,
    });
    return Response.redirect(`${failRedirect}&reason=token_fetch_error`, 302);
  }

  if (!tokenData.access_token || !tokenData.refresh_token) {
    await adminClient.from("sender_action_logs").insert({
      action: "zalo_oauth_failed",
      sender_type: "business",
      performed_by: user_id,
      result: "error",
      note: `Zalo trả về lỗi trao đổi token: ${tokenData.message || tokenData.error || "unknown"}`,
    });
    return Response.redirect(`${failRedirect}&reason=token_exchange_failed`, 302);
  }

  // ── Lấy thông tin OA (getoa) để hiển thị tên OA ───────────────────────────
  let oaDisplayName = sender_name;
  let resolvedOaId = oa_id || "";
  try {
    const oaRes = await fetch("https://openapi.zalo.me/v3.0/oa/getoa", {
      headers: { "access_token": tokenData.access_token },
    });
    const oaData = await oaRes.json() as { data?: { oa_id?: string; name?: string } };
    if (oaData?.data?.name) oaDisplayName = oaData.data.name;
    if (oaData?.data?.oa_id) resolvedOaId = oaData.data.oa_id;
  } catch {
    // OA info không bắt buộc — nếu lỗi thì dùng tên người dùng đặt
  }

  // ── Mã hóa tokens trước khi lưu DB ────────────────────────────────────────
  const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;
  const accessTokenEnc = await encryptToken(tokenData.access_token, tokenEncKey);
  const refreshTokenEnc = await encryptToken(tokenData.refresh_token, tokenEncKey);

  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 3600) * 1000,
  ).toISOString();

  // ── Tạo hoặc cập nhật sender_accounts ────────────────────────────────────
  // Tìm xem đã có sender với external_account_id này chưa
  const { data: existing } = await adminClient
    .from("sender_accounts")
    .select("id")
    .eq("external_account_id", resolvedOaId || app_id)
    .maybeSingle();

  let senderAccountId: string;

  if (existing?.id) {
    // Cập nhật sender hiện có
    await adminClient.from("sender_accounts").update({
      name: oaDisplayName,
      display_name: oaDisplayName,
      provider: "zalo",
      channel: "zalo_oa",
      auth_type: "oauth",
      external_app_id: app_id,
      external_account_id: resolvedOaId || app_id,
      health_status: "healthy",
      last_error: null,
      last_checked_at: new Date().toISOString(),
      is_active: true,
      status: "active",
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    senderAccountId = existing.id;
  } else {
    // Tạo sender mới
    const { data: newSender, error: insertErr } = await adminClient
      .from("sender_accounts")
      .insert({
        name: oaDisplayName,
        display_name: oaDisplayName,
        sender_email: `zalo-oa@${app_id}`,  // placeholder không dùng gửi thật
        sender_name: oaDisplayName,
        provider: "zalo",
        channel: "zalo_oa",
        auth_type: "oauth",
        external_app_id: app_id,
        external_account_id: resolvedOaId || app_id,
        health_status: "healthy",
        last_checked_at: new Date().toISOString(),
        is_active: true,
        status: "active",
        created_by: user_id,
        // Không lưu token tại đây — lưu vào bảng tách riêng
        secret_prefix: "ZALO_OA",
        daily_limit: 1000,
        daily_usage: 0,
      })
      .select("id")
      .single();

    if (insertErr || !newSender) {
      await adminClient.from("sender_action_logs").insert({
        action: "zalo_oauth_failed",
        sender_type: "business",
        performed_by: user_id,
        result: "error",
        note: `Lỗi tạo sender_accounts: ${insertErr?.message}`,
      });
      return Response.redirect(`${failRedirect}&reason=db_insert_failed`, 302);
    }
    senderAccountId = newSender.id;
  }

  // ── Lưu/cập nhật tokens vào bảng bảo mật sender_account_tokens ───────────
  // Dùng upsert — chỉ service_role mới có quyền write vào bảng này
  await adminClient.from("sender_account_tokens").upsert({
    sender_account_id: senderAccountId,
    access_token_enc: accessTokenEnc,
    refresh_token_enc: refreshTokenEnc,
    token_expires_at: expiresAt,
    token_scope: [],
    updated_at: new Date().toISOString(),
  }, { onConflict: "sender_account_id" });

  // ── Ghi Audit Log: zalo_oauth_connected ────────────────────────────────────
  await adminClient.from("sender_action_logs").insert({
    action: "zalo_oauth_connected",
    sender_id: senderAccountId,
    sender_type: "business",
    performed_by: user_id,
    result: "healthy",
    note: `Kết nối Zalo OA thành công — OA: ${oaDisplayName} (${resolvedOaId}) — App: ${app_id}`,
  });

  // ── Redirect Admin về UI với thông báo thành công ─────────────────────────
  return Response.redirect(successRedirect, 302);
});
