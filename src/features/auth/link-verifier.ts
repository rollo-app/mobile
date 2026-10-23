import { CryptoDigestAlgorithm, digest, getRandomBytes } from "expo-crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Base64url without padding (RFC 4648 §5). */
export function base64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2]! + ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b !== undefined) out += ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c !== undefined) out += ALPHABET[c & 63]!;
  }
  return out;
}

/**
 * A fresh secret for the login email's link (PKCE-style): the server gets `challenge` =
 * base64url(SHA-256(verifier)) and only whoever holds `verifier` (this phone) can use the link.
 */
export async function createLinkVerifier(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(getRandomBytes(32));
  const hash = await digest(CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(hash)) };
}
