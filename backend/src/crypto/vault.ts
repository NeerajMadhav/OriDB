/**
 * AES-256-GCM encrypt/decrypt for at-rest connection payloads.
 * Key material from ORIDB_MASTER_PASSWORD (PBKDF2) or dev fallback.
 */
import crypto from "node:crypto";

const PBKDF2_ITER = 210_000;
const SALT = "oridb-v1-salt"; // fixed salt for local vault; key entropy comes from password

function getPassword(): string {
  const p = process.env.ORIDB_MASTER_PASSWORD?.trim();
  if (p) return p;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ORIDB_MASTER_PASSWORD is required in production for encrypted storage",
    );
  }
  return "oridb-dev-change-me";
}

function deriveKey(): Buffer {
  return crypto.pbkdf2Sync(
    getPassword(),
    SALT,
    PBKDF2_ITER,
    32,
    "sha256",
  );
}

export function encryptJson(obj: unknown): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptJson<T>(b64: string): T {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const key = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}
