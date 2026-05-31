import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { decode } from "https://deno.land/std@0.182.0/encoding/base64.ts";

export interface SenderCredential {
  api_key?: string | null;
  access_token?: string | null;
  from_email?: string | null;
  auth_type: string;
  provider: string;
  credential_source?: string;
  sender_account_id?: string;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function decryptSenderToken(encrypted: string, keyString: string): Promise<string | null> {
  try {
    const parts = encrypted.split(":");
    if (parts.length !== 2) throw new Error("OLD_FORMAT_NO_COLON");
    const ivHex = parts[0];
    const ciphertextB64 = parts[1];
    
    // Hash key string to 32 bytes
    const encKeyData = new TextEncoder().encode(keyString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encKeyData);
    const key = await crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
    
    const iv = hexToBytes(ivHex);
    const ciphertext = decode(ciphertextB64);

    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    
    return new TextDecoder().decode(plaintext);
  } catch (e: any) {
    console.error("Decryption error:", e);
    throw new Error(`DECRYPT_ERROR: ${e.message || e}`);
  }
}

export async function resolveResendCredential(
  supabase: SupabaseClient, 
  sender_account_id?: string
): Promise<SenderCredential> {
  let auth_type = "platform_secret";
  let from_email = Deno.env.get("EMAIL_FROM_ADDRESS") || null;
  let api_key: string | null = null;

  if (sender_account_id) {
    const { data: senderData } = await supabase
      .from("sender_accounts")
      .select("auth_type, sender_email, status, is_active")
      .eq("id", sender_account_id)
      .single();

    if (senderData) {
      if (senderData.status === "archived") {
        throw new Error("SENDER_ACCOUNT_ARCHIVED");
      }
      if (!senderData.is_active) {
        throw new Error("SENDER_ACCOUNT_DISABLED");
      }

      auth_type = senderData.auth_type || "api_key"; // fallback defaults
      if (senderData.sender_email) {
        from_email = senderData.sender_email;
      }
    }
  }

  if (auth_type === "api_key" && sender_account_id) {
    const { data: tokenData } = await supabase
      .from("sender_account_tokens")
      .select("access_token_enc")
      .eq("sender_account_id", sender_account_id)
      .maybeSingle();

    if (tokenData?.access_token_enc) {
      const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const decrypted = await decryptSenderToken(tokenData.access_token_enc, tokenEncKey);
      if (decrypted) {
        console.log(`[Credential Resolver] Using sender credential source: api_key sender_account_id=${sender_account_id}`);
        api_key = decrypted;
      } else {
        throw new Error("RESEND_API_KEY_DECRYPTION_FAILED");
      }
    } else {
      throw new Error("RESEND_API_KEY_FOR_SENDER_MISSING");
    }
  } else {
    // auth_type === "platform_secret" hoặc thiếu sender_account_id -> dùng env fallback
    console.warn(`[Credential Resolver] No api_key configured or sender_account_id provided for provider '${provider}'. Using platform secret fallback from Deno.env.`);
    api_key = Deno.env.get("RESEND_API_KEY") || null;
    if (!api_key) {
      throw new Error("PLATFORM_RESEND_API_KEY_MISSING");
    }
  }

  if (!from_email) {
    throw new Error("EMAIL_FROM_ADDRESS_MISSING");
  }

  return { api_key, from_email, auth_type, provider: "resend" };
}

export async function resolveZaloCredential(
  supabase: SupabaseClient, 
  sender_account_id?: string
): Promise<SenderCredential> {
  let auth_type = "platform_secret";
  let access_token: string | null = null;
  let credential_source = "env";

  if (sender_account_id) {
    const { data: senderData } = await supabase
      .from("sender_accounts")
      .select("auth_type, status, is_active")
      .eq("id", sender_account_id)
      .single();

    if (senderData) {
      if (senderData.status === "archived") {
        throw new Error("SENDER_ACCOUNT_ARCHIVED");
      }
      if (!senderData.is_active) {
        throw new Error("SENDER_ACCOUNT_DISABLED");
      }

      auth_type = senderData.auth_type || "platform_secret";
    }
  }

  if ((auth_type === "oauth" || auth_type === "api_key") && sender_account_id) {
    const { data: tokenData } = await supabase
      .from("sender_account_tokens")
      .select("access_token_enc, token_expires_at")
      .eq("sender_account_id", sender_account_id)
      .maybeSingle();

    if (tokenData?.access_token_enc) {
      // Check if expired or expiring in less than 5 mins
      const isExpired = tokenData.token_expires_at 
        ? new Date(tokenData.token_expires_at).getTime() < Date.now() + 5 * 60 * 1000 
        : true;

      if (isExpired) {
        console.log(`[Credential Resolver] Zalo token expired or expiring soon for sender_account_id=${sender_account_id}. Refreshing...`);
        const { refreshZaloToken } = await import("./zalo-token-refresh.ts");
        access_token = await refreshZaloToken(supabase, sender_account_id);
        credential_source = "sender_token_refreshed";
      } else {
        const tokenEncKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const decrypted = await decryptSenderToken(tokenData.access_token_enc, tokenEncKey);
        if (decrypted) {
          console.log(`[Credential Resolver] Using Zalo credential source: sender_token sender_account_id=${sender_account_id}`);
          access_token = decrypted;
          credential_source = "sender_token";
        } else {
          throw new Error("ZALO_TOKEN_DECRYPT_FAILED");
        }
      }
    } else {
      throw new Error("ZALO_TOKEN_FOR_SENDER_MISSING");
    }
  } else {
    // Fallback platform secret
    console.warn(`[Credential Resolver] Using Zalo platform secret fallback`);
    access_token = Deno.env.get("ZALO_OA_ACCESS_TOKEN") || null;
    if (!access_token) {
      throw new Error("ZALO_OA_ACCESS_TOKEN_MISSING");
    }
    credential_source = "env";
  }

  return { 
    provider: "zalo_oa", 
    access_token, 
    credential_source, 
    sender_account_id, 
    auth_type 
  };
}

export async function getSenderCredential(
  supabase: SupabaseClient,
  provider: string,
  sender_account_id?: string
): Promise<SenderCredential> {
  if (provider === "resend" || provider === "email") {
    return await resolveResendCredential(supabase, sender_account_id);
  }
  
  if (provider === "zalo_oa" || provider === "zalo") {
    return await resolveZaloCredential(supabase, sender_account_id);
  }
  
  throw new Error(`Credential resolution for provider '${provider}' is not implemented yet.`);
}
