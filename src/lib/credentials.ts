import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM helpers for order credentials (Roblox logins, parental PINs).
 *
 * Stored format: `v1.<iv-b64>.<tag-b64>.<ciphertext-b64>`.
 * The key comes from ENCRYPTION_KEY (64 hex chars = 32 bytes).
 */

const VERSION = "v1";
const isProd = process.env.NODE_ENV === "production";

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (isProd) {
      throw new Error("ENCRYPTION_KEY is not set — refusing to start in production.");
    }
    throw new Error("ENCRYPTION_KEY is not set — cannot encrypt credentials.");
  }
  const hex = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt a UTF-8 string into the `v1.iv.tag.ciphertext` envelope. */
export function encryptSecret(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(
    ".",
  );
}

/** Decrypt a `v1.iv.tag.ciphertext` envelope back to UTF-8. */
export function decryptSecret(envelope: string): string {
  const key = encryptionKey();
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed credential envelope.");
  }
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Shape of the JSON blob stored in Order.credentialsEnc. */
export interface StoredCredentials {
  username?: string;
  password?: string;
  parentalPin?: string;
  /** space-joined 2FA backup codes for login-sharing flows (premium/login) */
  twoFactorBackupCodes?: string;
}

export function encryptCredentials(creds: StoredCredentials): string {
  return encryptSecret(JSON.stringify(creds));
}

export function decryptCredentials(envelope: string): StoredCredentials {
  return JSON.parse(decryptSecret(envelope)) as StoredCredentials;
}

/** Mask a secret for display: keep last 2 chars, dot the rest (min 4 dots). */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  const visible = secret.slice(-2);
  const dots = "•".repeat(Math.max(4, Math.min(12, secret.length - visible.length)));
  return `${dots}${visible}`;
}

/** False when encrypt/decrypt would throw (missing or malformed key). */
export function hasEncryptionKey(): boolean {
  const raw = process.env.ENCRYPTION_KEY;
  return Boolean(raw && /^[0-9a-fA-F]{64}$/.test(raw.trim()));
}
