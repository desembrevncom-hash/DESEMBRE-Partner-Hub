import { encode, decode } from "https://deno.land/std@0.182.0/encoding/base64url.ts";

export interface UnsubscribePayload {
  customerId: string;
  email: string;
  campaignId?: string;
  deliveryLogId?: string;
  exp?: number;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function getEncryptionKey(keyString: string): Promise<CryptoKey> {
  // Hash the string to get a 32-byte key (AES-256)
  const encKeyData = new TextEncoder().encode(keyString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encKeyData);
  return await crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Generate a secure, opaque unsubscribe token.
 */
export async function generateUnsubscribeToken(
  payload: UnsubscribePayload,
  secretKey: string
): Promise<string> {
  const key = await getEncryptionKey(secretKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const payloadStr = JSON.stringify(payload);
  const encodedPayload = new TextEncoder().encode(payloadStr);

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodedPayload);
  
  // Format: iv length is 12 bytes. Combine IV + Ciphertext into one array.
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return encode(combined.buffer);
}

/**
 * Verify and parse an unsubscribe token.
 */
export async function verifyUnsubscribeToken(
  token: string,
  secretKey: string
): Promise<UnsubscribePayload | null> {
  try {
    const key = await getEncryptionKey(secretKey);
    const combined = decode(token);

    if (combined.length < 12) {
      return null;
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    
    const payloadStr = new TextDecoder().decode(decrypted);
    return JSON.parse(payloadStr) as UnsubscribePayload;
  } catch (err) {
    console.warn("Failed to verify unsubscribe token:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
