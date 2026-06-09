// Shared Crypto Helpers for API Keys
// Uses AES-GCM 256 for symmetric encryption

// Helper to decode base64 master key
function getMasterKeyMaterial(): Uint8Array {
  const masterKeyString = Deno.env.get("AI_SETTINGS_MASTER_KEY");
  if (!masterKeyString) {
    throw new Error("AI_SETTINGS_MASTER_KEY is missing in Edge Function secrets.");
  }

  try {
    const binaryString = atob(masterKeyString);
    const keyMaterial = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      keyMaterial[i] = binaryString.charCodeAt(i);
    }

    if (keyMaterial.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(keyMaterial);
      return padded;
    } else if (keyMaterial.length > 32) {
      return keyMaterial.slice(0, 32);
    }
    return keyMaterial;
  } catch (e) {
    // If it's not valid base64, fallback to string encoding
    const encoder = new TextEncoder();
    let keyMaterial = encoder.encode(masterKeyString);
    if (keyMaterial.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(keyMaterial);
      return padded;
    } else if (keyMaterial.length > 32) {
      return keyMaterial.slice(0, 32);
    }
    return keyMaterial;
  }
}

export async function encryptApiKey(
  plaintext: string,
): Promise<{ ciphertext: string; mask: string }> {
  const keyMaterial = getMasterKeyMaterial();
  const cryptoKey = await crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(plaintext),
  );

  const combined = new Uint8Array(iv.length + encryptedBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuf), iv.length);

  // Convert to base64
  const base64Ciphertext = btoa(String.fromCharCode(...combined));

  // Create mask (e.g., sk-...abcd)
  let mask = "sk-...";
  if (plaintext.length > 8) {
    const prefix = plaintext.startsWith("sk-") ? "sk-" : plaintext.substring(0, 3);
    const suffix = plaintext.substring(plaintext.length - 4);
    mask = `${prefix}...${suffix}`;
  } else {
    mask = "***";
  }

  return { ciphertext: base64Ciphertext, mask };
}

export async function decryptApiKey(base64Ciphertext: string): Promise<string> {
  const keyMaterial = getMasterKeyMaterial();
  const cryptoKey = await crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);

  const combinedStr = atob(base64Ciphertext);
  const combined = new Uint8Array(combinedStr.length);
  for (let i = 0; i < combinedStr.length; i++) {
    combined[i] = combinedStr.charCodeAt(i);
  }

  const iv = combined.slice(0, 12);
  const ciphertextBuf = combined.slice(12);

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertextBuf,
  );

  return new TextDecoder().decode(decryptedBuf);
}
