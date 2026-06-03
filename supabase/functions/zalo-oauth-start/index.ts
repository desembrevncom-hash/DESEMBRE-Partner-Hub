import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// ── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Crypto helpers ────────────────────────────────────────────────────────────
/**
 * Tạo một random string alphanumeric đúng 43 ký tự làm PKCE code_verifier.
 * Tuân theo Zalo OA v4 requirement: 43 chars, [A-Za-z0-9].
 */
function generateCodeVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(43);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => chars[b % chars.length])
    .join("");
}

/**
 * Tạo code_challenge từ code_verifier theo chuẩn S256 PKCE.
 * code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Mã hóa state payload bằng AES-GCM với encryption key từ env.
 * State chứa: user_id, sender_name, app_id, oa_id, code_verifier, expires_at.
 * State này sẽ được truyền qua Zalo redirect và giải mã ở callback.
 */
async function encryptState(payload: Record<string, unknown>, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex.padEnd(64, "0").slice(0, 64));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Trả về: iv_hex:ciphertext_b64
  return bytesToHex(iv) + ":" + btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // ── Verify JWT & Role (Admin/SubAdmin only) ─────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    data: { user },
    error: authErr,
  } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));

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

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { sender_name: string; app_id: string; oa_id?: string; redirect_uri?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { sender_name, app_id, oa_id = "", redirect_uri } = body;

  if (!sender_name?.trim() || !app_id?.trim()) {
    return new Response(JSON.stringify({ error: "sender_name and app_id are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Build redirect_uri (callback phải được đăng ký trong Zalo Developers) ─
  const supabaseFunctionsUrl = `${supabaseUrl.replace(".supabase.co", ".supabase.co")}/functions/v1`;
  const callbackUrl = redirect_uri || `${supabaseFunctionsUrl}/zalo-oauth-callback`;

  // ── Tạo PKCE code_verifier + code_challenge ─────────────────────────────────
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // ── Tạo state payload (sẽ được mã hóa để chống CSRF và relay code_verifier) ─
  const stateEncKey =
    Deno.env.get("OAUTH_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback";
  const statePayload = {
    user_id: user.id,
    sender_name: sender_name.trim(),
    app_id: app_id.trim(),
    oa_id: oa_id.trim(),
    code_verifier: codeVerifier,
    redirect_uri: callbackUrl,
    expires_at: Date.now() + 10 * 60 * 1000, // 10 phút TTL (Zalo auth code TTL)
    nonce: bytesToHex(crypto.getRandomValues(new Uint8Array(8))),
  };

  const encryptedState = await encryptState(statePayload, stateEncKey);

  // ── Ghi Audit Log: zalo_oauth_started ───────────────────────────────────────
  await adminClient.from("sender_action_logs").insert({
    action: "zalo_oauth_started",
    sender_id: null,
    sender_type: "business",
    performed_by: user.id,
    result: "ok",
    note: `OAuth flow khởi tạo cho App ID: ${app_id} — Sender: ${sender_name}`,
  });

  // ── Trả về Zalo OAuth Authorization URL ─────────────────────────────────────
  // Endpoint phân quyền OA v4: https://oauth.zaloapp.com/v4/oa/permission
  const params = new URLSearchParams({
    app_id: app_id.trim(),
    redirect_uri: callbackUrl,
    code_challenge: codeChallenge,
    state: encryptedState,
  });

  const zaloOAuthUrl = `https://oauth.zaloapp.com/v4/oa/permission?${params.toString()}`;

  return new Response(
    JSON.stringify({
      oauth_url: zaloOAuthUrl,
      // KHÔNG trả về code_verifier, code_challenge, hay state thô ra client
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
