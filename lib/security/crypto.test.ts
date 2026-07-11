import { describe, it, expect } from "vitest";
import { encrypt, decrypt, safeDecrypt, isEncrypted, encryptIfNeeded } from "./crypto";

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a value", () => {
    const c = encrypt("EAAB-secret-fb-token");
    expect(isEncrypted(c)).toBe(true);
    expect(decrypt(c)).toBe("EAAB-secret-fb-token");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encrypt("x")).not.toBe(encrypt("x"));
  });

  it("safeDecrypt passes plaintext through unchanged (backward compat)", () => {
    expect(safeDecrypt("legacy-plaintext-token")).toBe("legacy-plaintext-token");
  });

  it("safeDecrypt decrypts an encrypted value", () => {
    expect(safeDecrypt(encrypt("y"))).toBe("y");
  });

  it("encryptIfNeeded is idempotent on already-encrypted input", () => {
    const c = encrypt("z");
    expect(encryptIfNeeded(c)).toBe(c);
  });

  it("detects tampering (auth tag)", () => {
    const c = encrypt("z");
    const tampered = c.slice(0, -2) + (c.endsWith("00") ? "11" : "00");
    expect(() => decrypt(tampered)).toThrow();
  });
});
