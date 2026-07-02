import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"require('crypto').randomBytes(32).toString('hex')\""
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a credentials object to a compact string: `iv:authTag:ciphertext` (all hex).
 */
export function encryptCredentials(credentials: Record<string, string>): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string produced by `encryptCredentials`. Returns an empty object on failure.
 */
export function decryptCredentials(stored: string): Record<string, string> {
  if (!stored || stored === "{}") return {};
  // Legacy plaintext JSON (plain object) — migrate transparently
  if (stored.startsWith("{")) {
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }
  try {
    const [ivHex, tagHex, ctHex] = stored.split(":");
    if (!ivHex || !tagHex || !ctHex) return {};
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ctHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return {};
  }
}
