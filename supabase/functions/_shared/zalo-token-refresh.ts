import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function decryptZaloToken(encrypted: string, keyHex: string): Promise<string | null> {
  try {
    const [ivHex, ciphertextB64] = encrypted.split(":");
    if (!ivHex || !ciphertextB64) return null;
    const keyBytes = hexToBytes(keyHex.padEnd(64, "0").slice(0, 64));
    const key = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"],
    );
    const iv = hexToBytes(ivHex);
    const ciphertext = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

export async function encryptZaloToken(token: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex.padEnd(64, "0").slice(0, 64));
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  return ivHex + ":" + btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
}

/**
 * Đọc refresh_token từ DB, giải mã, gọi API Zalo để lấy access_token mới,
 * mã hoá token mới và lưu lại vào DB. Trả về access_token rõ trong RAM.
 */
export async function refreshZaloToken(adminClient: SupabaseClient, sender_account_id: string): Promise<string> {
  const { data: sender, error: senderErr } = await adminClient
    .from("sender_accounts")
    .select("id, name, external_app_id")
    .eq("id", sender_account_id)
    .maybeSingle();

  if (senderErr || !sender) {
    throw new Error("SENDER_NOT_FOUND");
  }

  const { data: tokenRow, error: tokenErr } = await adminClient
    .from("sender_account_tokens")
    .select("refresh_token_enc")
    .eq("sender_account_id", sender_account_id)
    .maybeSingle();

  if (tokenErr || !tokenRow?.refresh_token_enc) {
    throw new Error("ZALO_REFRESH_TOKEN_MISSING");
  }

  const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const refreshToken = await decryptZaloToken(tokenRow.refresh_token_enc, tokenEncKey);

  if (!refreshToken) {
    throw new Error("ZALO_TOKEN_DECRYPT_FAILED");
  }

  const appId = sender.external_app_id || "";
  const zaloAppSecret = (appId ? Deno.env.get(`ZALO_APP_SECRET_${appId}`) : null) || Deno.env.get("ZALO_APP_SECRET") || "";

  if (!zaloAppSecret) {
    throw new Error("ZALO_APP_SECRET_MISSING");
  }

  const refreshParams = new URLSearchParams({
    app_id: appId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let newTokenData: any;
  try {
    const refreshRes = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "secret_key": zaloAppSecret,
      },
      body: refreshParams.toString(),
    });
    newTokenData = await refreshRes.json();
  } catch (e: any) {
    throw new Error(`ZALO_TOKEN_REFRESH_FAILED: ${e.message}`);
  }

  if (!newTokenData.access_token) {
    const reason = newTokenData.message || String(newTokenData.error) || "unknown";
    
    // Update sender health status to warning/error if needed, but here we just throw
    await adminClient.from("sender_accounts").update({
      health_status: "error",
      last_error: `Zalo refresh failed: ${reason}`,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", sender_account_id);

    throw new Error(`ZALO_TOKEN_REFRESH_FAILED: ${reason}`);
  }

  const newAccessEnc = await encryptZaloToken(newTokenData.access_token, tokenEncKey);
  const newRefreshEnc = newTokenData.refresh_token
    ? await encryptZaloToken(newTokenData.refresh_token, tokenEncKey)
    : tokenRow.refresh_token_enc;

  const newExpiresAt = new Date(Date.now() + (newTokenData.expires_in ?? 3600) * 1000).toISOString();

  await adminClient.from("sender_account_tokens").upsert({
    sender_account_id,
    access_token_enc: newAccessEnc,
    refresh_token_enc: newRefreshEnc,
    token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "sender_account_id" });

  await adminClient.from("sender_accounts").update({
    health_status: "healthy",
    last_error: null,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", sender_account_id);

  // Audit log
  await adminClient.from("sender_action_logs").insert({
    action: "zalo_token_refreshed",
    sender_id: sender_account_id,
    sender_type: "business",
    result: "healthy",
    note: `Token làm mới thành công (Auto-refresh) cho sender: ${sender.name}.`,
  });

  return newTokenData.access_token;
}
