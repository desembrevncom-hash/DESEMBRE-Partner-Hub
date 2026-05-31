import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { decode } from "https://deno.land/std@0.182.0/encoding/base64.ts";

export interface SenderCredential {
  api_key: string | null;
  from_email: string | null;
  auth_type: string;
  provider: string;
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
      .select("auth_type, sender_email")
      .eq("id", sender_account_id)
      .single();

    if (senderData) {
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

export async function getSenderCredential(
  supabase: SupabaseClient,
  provider: string,
  sender_account_id?: string
): Promise<SenderCredential> {
  if (provider === "resend" || provider === "email") {
    return await resolveResendCredential(supabase, sender_account_id);
  }
  
  throw new Error(`Credential resolution for provider '${provider}' is not implemented yet.`);
}
