// lib/security/crypto.ts
// Authenticated symmetric encryption (AES-256-GCM) for data at rest.
//
// Replaces the old lib/encryption.js, which fell back to a RANDOM key when
// ENCRYPTION_KEY was unset — making anything it encrypted permanently
// undecryptable after a restart. The key now comes from validated env and is
// required.
//
// Design goals:
//  - Backward compatible: safeDecrypt() returns plaintext unchanged if the value
//    is NOT in our encrypted format, so existing plaintext token rows keep
//    working while a migration encrypts them over time.
//  - Never throws on read: safeDecrypt swallows errors and returns the input, so
//    a decryption problem can never take down a request that reads a token.

import crypto from "node:crypto";
import { env } from "@/lib/config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex"); // 32 bytes

// Format: v1:<iv hex>:<authTag hex>:<ciphertext hex>
const PREFIX = "v1";
const ENCRYPTED_RE = /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

/** Encrypt a UTF-8 string. Returns the versioned, self-describing envelope. */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [PREFIX, iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

/** True if `value` looks like something encrypt() produced. */
export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && ENCRYPTED_RE.test(value);
}

/** Decrypt an envelope produced by encrypt(). Throws on tampering/format errors. */
export function decrypt(envelope: string): string {
  const [, ivHex, tagHex, dataHex] = envelope.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Decrypt if encrypted, otherwise return the value untouched. Never throws.
 * This is what makes rollout safe: legacy plaintext passes through, encrypted
 * values are decrypted, and any error degrades to returning the raw value.
 */
export function safeDecrypt<T>(value: T): T {
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value) as unknown as T;
  } catch {
    return value;
  }
}

/** Encrypt a value only if it is a non-empty, not-already-encrypted string. */
export function encryptIfNeeded(value: unknown): unknown {
  if (typeof value !== "string" || value.length === 0) return value;
  if (isEncrypted(value)) return value;
  return encrypt(value);
}
