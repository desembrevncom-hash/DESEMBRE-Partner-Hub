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

async function decryptToken(encrypted: string, keyHex: string): Promise<string | null> {
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

async function encryptToken(token: string, keyHex: string): Promise<string> {
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

// ── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // ── Auth: Admin/SubAdmin hoặc internal service call ─────────────────────────
  const authHeader = req.headers.get("Authorization");
  const internalKey = req.headers.get("X-Internal-Key");
  const expectedInternalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") || "";

  let callerUserId: string | null = null;
  let isInternalCall = false;

  if (internalKey && expectedInternalKey && internalKey === expectedInternalKey) {
    // Gọi nội bộ từ cron/edge function khác
    isInternalCall = true;
  } else if (authHeader) {
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "sub_admin"])
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin or SubAdmin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    callerUserId = user.id;
  } else {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { sender_account_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { sender_account_id } = body;
  if (!sender_account_id) {
    return new Response(JSON.stringify({ error: "sender_account_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Load sender + token record (service_role bypasses RLS on tokens table) ─
  const { data: sender, error: senderErr } = await adminClient
    .from("sender_accounts")
    .select("id, name, provider, channel, external_app_id, is_active")
    .eq("id", sender_account_id)
    .maybeSingle();

  if (senderErr || !sender) {
    return new Response(JSON.stringify({ error: "Sender account not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (sender.provider?.toLowerCase() !== "zalo") {
    return new Response(JSON.stringify({ error: "Sender is not a Zalo OA account" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: tokenRow, error: tokenErr } = await adminClient
    .from("sender_account_tokens")
    .select("refresh_token_enc, token_expires_at")
    .eq("sender_account_id", sender_account_id)
    .maybeSingle();

  if (tokenErr || !tokenRow?.refresh_token_enc) {
    await adminClient.from("sender_action_logs").insert({
      action: "zalo_connection_failed",
      sender_id: sender_account_id,
      sender_type: "business",
      performed_by: callerUserId,
      result: "error",
      note: "Không tìm thấy refresh_token. Cần kết nối lại Zalo OA.",
    });

    // Mark sender as error
    await adminClient.from("sender_accounts").update({
      health_status: "error",
      last_error: "Không tìm thấy refresh_token — cần kết nối lại OAuth",
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", sender_account_id);

    return new Response(
      JSON.stringify({ success: false, error: "No refresh token found. Please reconnect Zalo OA." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Giải mã refresh_token ─────────────────────────────────────────────────
  const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;
  const refreshToken = await decryptToken(tokenRow.refresh_token_enc, tokenEncKey);

  if (!refreshToken) {
    await adminClient.from("sender_action_logs").insert({
      action: "zalo_connection_failed",
      sender_id: sender_account_id,
      sender_type: "business",
      performed_by: callerUserId,
      result: "error",
      note: "Giải mã refresh_token thất bại — token có thể bị hỏng.",
    });
    await adminClient.from("sender_accounts").update({
      health_status: "error",
      last_error: "Giải mã refresh_token thất bại",
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", sender_account_id);

    return new Response(
      JSON.stringify({ success: false, error: "Failed to decrypt refresh token. Please reconnect." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Lấy App Secret ────────────────────────────────────────────────────────
  const appId = sender.external_app_id || "";
  const zaloAppSecret =
    (appId ? Deno.env.get(`ZALO_APP_SECRET_${appId}`) : null) ||
    Deno.env.get("ZALO_APP_SECRET") || "";

  if (!zaloAppSecret) {
    return new Response(
      JSON.stringify({ success: false, error: `Thiếu ZALO_APP_SECRET cho App ID: ${appId}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Gọi Zalo API refresh token ────────────────────────────────────────────
  // POST https://oauth.zaloapp.com/v4/oa/access_token
  // Header: secret_key
  // Body: app_id, grant_type=refresh_token, refresh_token
  let newTokenData: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string | number;
    message?: string;
  };

  try {
    const refreshParams = new URLSearchParams({
      app_id: appId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const refreshRes = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "secret_key": zaloAppSecret,
      },
      body: refreshParams.toString(),
    });

    newTokenData = await refreshRes.json();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await adminClient.from("sender_action_logs").insert({
      action: "zalo_connection_failed",
      sender_id: sender_account_id,
      sender_type: "business",
      performed_by: callerUserId,
      result: "error",
      note: `Lỗi kết nối Zalo khi refresh token: ${msg}`,
    });
    await adminClient.from("sender_accounts").update({
      health_status: "warning",
      last_error: `Refresh token network error: ${msg}`,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", sender_account_id);

    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!newTokenData.access_token) {
    const reason = newTokenData.message || String(newTokenData.error) || "unknown";
    await adminClient.from("sender_action_logs").insert({
      action: "zalo_connection_failed",
      sender_id: sender_account_id,
      sender_type: "business",
      performed_by: callerUserId,
      result: "error",
      note: `Zalo từ chối refresh token: ${reason}. Cần kết nối lại OAuth.`,
    });
    await adminClient.from("sender_accounts").update({
      health_status: "error",
      last_error: `Zalo refresh failed: ${reason}`,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", sender_account_id);

    return new Response(
      JSON.stringify({ success: false, error: `Zalo refresh failed: ${reason}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Mã hóa và lưu tokens mới ─────────────────────────────────────────────
  const newAccessEnc = await encryptToken(newTokenData.access_token, tokenEncKey);
  // Zalo thường trả về refresh_token mới — dùng mới nếu có, giữ cũ nếu không
  const newRefreshEnc = newTokenData.refresh_token
    ? await encryptToken(newTokenData.refresh_token, tokenEncKey)
    : tokenRow.refresh_token_enc;

  const newExpiresAt = new Date(
    Date.now() + (newTokenData.expires_in ?? 3600) * 1000,
  ).toISOString();

  await adminClient.from("sender_account_tokens").upsert({
    sender_account_id,
    access_token_enc: newAccessEnc,
    refresh_token_enc: newRefreshEnc,
    token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "sender_account_id" });

  // ── Cập nhật health_status sender ────────────────────────────────────────
  await adminClient.from("sender_accounts").update({
    health_status: "healthy",
    last_error: null,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", sender_account_id);

  // ── Audit log: zalo_token_refreshed ──────────────────────────────────────
  await adminClient.from("sender_action_logs").insert({
    action: "zalo_token_refreshed",
    sender_id: sender_account_id,
    sender_type: "business",
    performed_by: callerUserId,
    result: "healthy",
    note: `Token làm mới thành công cho sender: ${sender.name}. Hết hạn: ${newExpiresAt}`,
  });

  return new Response(
    JSON.stringify({
      success: true,
      health_status: "healthy",
      token_expires_at: newExpiresAt,
      // Không trả về access_token hay refresh_token — chỉ metadata
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
