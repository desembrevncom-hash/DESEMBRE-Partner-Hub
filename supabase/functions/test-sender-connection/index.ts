import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Crypto helpers (shared với refresh-zalo-token) ───────────────────────────
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ─── Verify JWT & Role ──────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify admin/subadmin role
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "sub_admin"])
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden: Admin or SubAdmin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── Parse payload ──────────────────────────────────────────────────────────
  try {
    const { sender_id, sender_type } = await req.json();

    if (!sender_id || !sender_type) {
      return new Response(JSON.stringify({ error: "sender_id and sender_type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["business", "personal"].includes(sender_type)) {
      return new Response(
        JSON.stringify({ error: "sender_type must be 'business' or 'personal'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let healthStatus: "healthy" | "warning" | "error" = "error";
    let lastError: string | null = null;

    // ─── Business Sender Test ───────────────────────────────────────────────
    if (sender_type === "business") {
      const { data: sender, error: senderErr } = await supabase
        .from("sender_accounts")
        .select("id, name, provider, channel, is_active, auth_type, secret_prefix, provider_secret")
        .eq("id", sender_id)
        .maybeSingle();

      if (senderErr || !sender) {
        lastError = "Sender account not found";
        healthStatus = "error";
      } else if (!sender.is_active) {
        lastError = "Sender is disabled";
        healthStatus = "warning";
      } else {
        // Provider-specific checks (no real messages sent)
        const provider = (sender.provider || "").toLowerCase();

        if (provider === "resend" || provider === "email") {
          const resendKey = sender.provider_secret || Deno.env.get("RESEND_API_KEY");
          if (!resendKey || resendKey.length < 10) {
            healthStatus = "error";
            lastError = "Chưa cấu hình khóa API Key (provider_secret) cho tài khoản này";
          } else {
            // Light probe: check if key starts with re_ (Resend format)
            healthStatus = resendKey.startsWith("re_") ? "healthy" : "warning";
            lastError =
              healthStatus === "warning"
                ? "RESEND_API_KEY có định dạng không đúng (phải bắt đầu bằng re_)"
                : null;
          }
        } else if (provider === "zalo" || provider === "zalo_oa") {
          // ── Kiểm tra Zalo OA qua token trong sender_account_tokens ──────────
          // service_role bypasses RLS nên đọc được bảng tokens
          const { data: tokenRow } = await supabase
            .from("sender_account_tokens")
            .select("access_token_enc, refresh_token_enc, token_expires_at")
            .eq("sender_account_id", sender_id)
            .maybeSingle();

          if (!tokenRow?.access_token_enc) {
            healthStatus = "error";
            lastError = "Chưa kết nối Zalo OA — chạy lại OAuth flow để kết nối.";
          } else {
            // Kiểm tra token hết hạn → tự động refresh
            const expiresAt = new Date(tokenRow.token_expires_at).getTime();
            const isExpired = Date.now() > expiresAt - 5 * 60 * 1000; // refresh sớm 5 phút

            let accessToken: string | null = null;

            if (isExpired) {
              // Gọi nội bộ refresh-zalo-token
              try {
                const supabaseFnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
                const internalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") || "";
                const refreshRes = await fetch(`${supabaseFnUrl}/refresh-zalo-token`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Internal-Key": internalKey,
                  },
                  body: JSON.stringify({ sender_account_id: sender_id }),
                });
                const refreshData = (await refreshRes.json()) as {
                  success?: boolean;
                  error?: string;
                };
                if (!refreshData.success) {
                  healthStatus = "error";
                  lastError = `Refresh token thất bại: ${refreshData.error || "unknown"}. Cần kết nối lại OAuth.`;
                } else {
                  // Đọc lại token mới sau khi refresh
                  const { data: newTokenRow } = await supabase
                    .from("sender_account_tokens")
                    .select("access_token_enc")
                    .eq("sender_account_id", sender_id)
                    .maybeSingle();
                  const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;
                  if (newTokenRow?.access_token_enc) {
                    accessToken = await decryptToken(newTokenRow.access_token_enc, tokenEncKey);
                  }
                }
              } catch (refreshErr: unknown) {
                const msg = refreshErr instanceof Error ? refreshErr.message : "network error";
                healthStatus = "warning";
                lastError = `Không thể gọi refresh-zalo-token: ${msg}`;
              }
            } else {
              // Token còn hạn — giải mã để probe
              const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;
              accessToken = await decryptToken(tokenRow.access_token_enc, tokenEncKey);
            }

            // ── Live probe: gọi Zalo OA info endpoint ─────────────────────
            if (accessToken && !lastError) {
              try {
                const oaRes = await fetch("https://openapi.zalo.me/v3.0/oa/getoa", {
                  headers: { access_token: accessToken },
                });
                const oaData = (await oaRes.json()) as {
                  error?: number;
                  message?: string;
                  data?: { oa_id?: string; name?: string };
                };

                if (oaData.error && oaData.error !== 0) {
                  healthStatus = "error";
                  lastError = `Zalo OA API error ${oaData.error}: ${oaData.message || "unknown"}. Token có thể đã hết hạn.`;
                } else {
                  healthStatus = "healthy";
                  lastError = null;
                  // Cập nhật display_name nếu lấy được từ Zalo
                  if (oaData.data?.name) {
                    await supabase
                      .from("sender_accounts")
                      .update({
                        display_name: oaData.data.name,
                      })
                      .eq("id", sender_id);
                  }
                }
              } catch {
                // Lỗi network khi probe — đánh dấu warning, không phải error
                healthStatus = "warning";
                lastError = "Không thể kết nối Zalo OA API để xác minh. Kiểm tra lại mạng.";
              }
            } else if (!lastError) {
              // accessToken null nhưng không có lỗi refresh — coi là warning
              healthStatus = "warning";
              lastError = "Không giải mã được access token.";
            }
          }
        } else if (provider === "gmail/google" || provider === "google_calendar") {
          const prefix = sender.secret_prefix || "GOOGLE_DEFAULT";

          let clientId = Deno.env.get(`${prefix}_CLIENT_ID`);
          let clientSecret = Deno.env.get(`${prefix}_CLIENT_SECRET`);
          let refreshToken = Deno.env.get(`${prefix}_REFRESH_TOKEN`);

          // Ưu tiên đọc từ cột provider_secret (dạng JSON) nếu có
          if (sender.provider_secret) {
            try {
              const parsedSecret = JSON.parse(sender.provider_secret);
              if (parsedSecret.clientId) clientId = parsedSecret.clientId;
              if (parsedSecret.clientSecret) clientSecret = parsedSecret.clientSecret;
              if (parsedSecret.refreshToken) refreshToken = parsedSecret.refreshToken;
            } catch (e) {
              console.warn("Lỗi phân tích JSON từ provider_secret:", e);
            }
          }

          if (!clientId || !clientSecret || !refreshToken) {
            healthStatus = "error";
            lastError = `Thiếu bộ khóa OAuth (Client ID, Client Secret, Refresh Token). Vui lòng cập nhật cấu hình Sender.`;
          } else {
            try {
              const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  client_id: clientId.trim(),
                  client_secret: clientSecret.trim(),
                  refresh_token: refreshToken.trim(),
                  grant_type: "refresh_token",
                }),
              });

              const tokenData = await tokenResponse.json();
              if (tokenResponse.ok && tokenData.access_token) {
                healthStatus = "healthy";
                lastError = null;
              } else {
                healthStatus = "error";
                lastError = `Xác thực Google OAuth thất bại: ${tokenData.error_description || tokenData.error || "Không lấy được access token"}`;
              }
            } catch (err: any) {
              healthStatus = "warning";
              lastError = `Không thể kết nối đến Google OAuth API: ${err.message}`;
            }
          }
        } else {
          // Generic: if sender is active and has a provider, mark as warning (unverified)
          healthStatus = "warning";
          lastError = `Provider '${provider}' chưa được kiểm tra tự động`;
        }
      }

      // Update health status
      await supabase
        .from("sender_accounts")
        .update({
          health_status: healthStatus,
          last_checked_at: new Date().toISOString(),
          last_error: lastError,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sender_id);
    }

    // ─── Personal Sender Test ───────────────────────────────────────────────
    if (sender_type === "personal") {
      const { data: account, error: accErr } = await supabase
        .from("user_communication_accounts")
        .select("id, platform, account_name, account_identifier, is_active, status")
        .eq("id", sender_id)
        .maybeSingle();

      if (accErr || !account) {
        lastError = "Personal sender account not found";
        healthStatus = "error";
      } else if (!account.is_active) {
        lastError = "Tài khoản đã bị tắt";
        healthStatus = "warning";
      } else if (!account.account_identifier || account.account_identifier.trim() === "") {
        lastError = "Chưa cấu hình account identifier";
        healthStatus = "error";
      } else {
        // Basic presence check — no live call
        healthStatus = "healthy";
        lastError = null;
      }

      // Update health status
      await supabase
        .from("user_communication_accounts")
        .update({
          health_status: healthStatus,
          last_verified_at: new Date().toISOString(),
          last_error: lastError,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sender_id);
    }

    // ─── Write Audit Log ────────────────────────────────────────────────────
    await supabase.from("sender_action_logs").insert({
      action: "test_connection",
      sender_id,
      sender_type,
      performed_by: user.id,
      result: healthStatus,
      note: lastError || "Connection check completed",
    });

    return new Response(
      JSON.stringify({
        success: true,
        health_status: healthStatus,
        last_error: lastError,
        checked_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
