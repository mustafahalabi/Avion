import {
  encryptCredentials,
  decryptCredentials,
} from "@/lib/credentials-crypto";

/**
 * Env-var handling for the live preview: parse the pasted `KEY=VALUE` text, and
 * encrypt/decrypt the resulting map at rest (reusing the AES-256-GCM helper used
 * for provider tokens). The service applies these to the dev-server process so
 * apps that need a `DATABASE_URL` / API keys can boot.
 */

export type ParseEnvVarsResult =
  | { ok: true; env: Record<string, string> }
  | { ok: false; error: string };

// A valid POSIX-ish env var name: letters/underscore first, then alphanumerics.
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Strips one layer of matching single/double quotes wrapping a value. */
function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Parses `KEY=VALUE` lines into a map. Blank lines and `#` comments are skipped;
 * an optional leading `export ` is tolerated; values may contain `=`; wrapping
 * quotes are stripped. Returns an error for a malformed line or invalid key.
 */
export function parseEnvVars(input: string | null | undefined): ParseEnvVarsResult {
  const env: Record<string, string> = {};
  if (!input?.trim()) return { ok: true, env };

  const lines = input.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) continue;

    const line = raw.startsWith("export ") ? raw.slice(7).trim() : raw;
    const eq = line.indexOf("=");
    if (eq === -1) {
      return { ok: false, error: `Line ${i + 1}: expected KEY=VALUE.` };
    }

    const key = line.slice(0, eq).trim();
    if (!ENV_KEY_RE.test(key)) {
      return { ok: false, error: `Line ${i + 1}: invalid variable name "${key}".` };
    }

    env[key] = unquote(line.slice(eq + 1).trim());
  }

  return { ok: true, env };
}

/** Encrypts an env map to the compact `iv:tag:ciphertext` blob for storage. */
export function encryptEnvVars(env: Record<string, string>): string {
  return encryptCredentials(env);
}

/** Decrypts a stored blob back to an env map. Returns `{}` on any failure. */
export function decryptEnvVars(stored: string | null | undefined): Record<string, string> {
  if (!stored) return {};
  return decryptCredentials(stored);
}
