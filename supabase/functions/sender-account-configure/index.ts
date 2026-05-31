import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Crypto Helpers (AES-GCM server-side only) ────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function encryptToken(token: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex.padEnd(64, "0").slice(0, 64));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  return ivHex + ":" + btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Auth & Role verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).single();
    const role = roleData?.role;
    
    if (role !== "admin" && role !== "sub_admin") {
      return new Response(JSON.stringify({ success: false, error: "Forbidden: Admin/SubAdmin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Parse Body
    const { provider, sender_account_id, sender_name, sender_email, domain, api_key } = await req.json();

    if (provider !== "resend") {
      return new Response(JSON.stringify({ success: false, error: "Unsupported provider for configuration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!sender_account_id) {
       return new Response(JSON.stringify({ success: false, error: "Missing sender_account_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let domain_status = "unknown";
    let isKeyConfigured = false;
    let missing_config = [];

    // 3. API Key Logic
    if (api_key && api_key.trim() !== "") {
      const trimmedKey = api_key.trim();
      if (!trimmedKey.startsWith("re_")) {
        return new Response(JSON.stringify({ success: false, error: "Resend API Key phải bắt đầu bằng re_" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Check Domain on Resend
      const domainToCheck = domain || (sender_email ? sender_email.split("@")[1] : "");
      try {
        const res = await fetch(`https://api.resend.com/domains`, {
          headers: { "Authorization": `Bearer ${trimmedKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          const found = data.data?.find((d: any) => d.name === domainToCheck);
          if (found) {
            domain_status = found.status === "verified" ? "verified" : "unverified";
          } else {
            domain_status = "not_found";
          }
        } else {
           const errData = await res.json();
           return new Response(JSON.stringify({ success: false, error: `Lỗi kết nối Resend API: ${errData?.message || res.statusText}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: `Lỗi mạng khi gọi Resend: ${e.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Encrypt and Upsert into sender_account_tokens
      const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;
      const accessTokenEnc = await encryptToken(trimmedKey, tokenEncKey);
      
      const { error: upsertErr } = await adminClient.from("sender_account_tokens").upsert({
        sender_account_id,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: "",
        token_expires_at: "2099-12-31T23:59:59Z", // Mãi mãi trừ khi bị revoke
        updated_at: new Date().toISOString()
      }, { onConflict: "sender_account_id" });

      if (upsertErr) throw upsertErr;
      isKeyConfigured = true;
    } else {
      // Nếu không nhập key, check xem đã có key trong DB chưa
      const { data: existingToken } = await adminClient.from("sender_account_tokens")
         .select("access_token_enc")
         .eq("sender_account_id", sender_account_id)
         .maybeSingle();
      
      if (existingToken?.access_token_enc) {
         isKeyConfigured = true;
      } else {
         missing_config.push("RESEND_API_KEY_FOR_SENDER");
      }
    }

    // 4. Update metadata in sender_accounts
    const { error: updateErr } = await adminClient.from("sender_accounts").update({
      provider: "resend",
      auth_type: "api_key",
      sender_email: sender_email || null,
      sender_name: sender_name || null,
      health_status: isKeyConfigured ? (domain_status === "verified" ? "healthy" : "warning") : "error",
      status: isKeyConfigured ? "active" : "error",
      is_active: isKeyConfigured,
      updated_at: new Date().toISOString()
    }).eq("id", sender_account_id);

    if (updateErr) throw updateErr;

    // 5. Audit Log (No Secret)
    await adminClient.from("sender_action_logs").insert({
      action: "configure_resend",
      sender_id: sender_account_id,
      sender_type: "business",
      performed_by: user.id,
      result: isKeyConfigured ? "success" : "warning",
      note: `Updated Resend configuration (auth_type=api_key). Key updated: ${api_key ? "yes" : "no"}`,
    });

    return new Response(JSON.stringify({
      success: true,
      configured: isKeyConfigured,
      api_key_configured: isKeyConfigured,
      from_email: sender_email,
      domain_status,
      can_send_test: isKeyConfigured && domain_status === "verified",
      missing_config,
      message: "Cập nhật cấu hình thành công"
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
