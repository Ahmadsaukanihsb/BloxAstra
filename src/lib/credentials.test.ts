import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptCredentials,
  decryptSecret,
  encryptCredentials,
  encryptSecret,
  hasEncryptionKey,
  maskSecret,
} from "@/lib/credentials";

const KEY = "0123456789abcdef".repeat(4); // 64 hex chars

describe("AES-256-GCM envelope", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips secrets with a valid key", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    expect(hasEncryptionKey()).toBe(true);
    const envelope = encryptSecret("rangga_pradipta:hunter2:1234");
    expect(envelope.startsWith("v1.")).toBe(true);
    expect(decryptSecret(envelope)).toBe("rangga_pradipta:hunter2:1234");
  });

  it("round-trips the credential JSON shape", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const creds = { username: "aldo", password: "p4ss", parentalPin: "0000" };
    expect(decryptCredentials(encryptCredentials(creds))).toEqual(creds);
  });

  it("rejects malformed envelopes and wrong keys", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    expect(() => decryptSecret("v1.only.two.parts")).toThrow();
    expect(() => decryptSecret("v9." + "eA.".repeat(3))).toThrow();
    const envelope = encryptSecret("secret");
    vi.stubEnv("ENCRYPTION_KEY", "ff".repeat(32));
    expect(() => decryptSecret(envelope)).toThrow();
  });

  it("refuses to work without a well-formed key", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(hasEncryptionKey()).toBe(false);
    expect(() => encryptSecret("x")).toThrow();
    vi.stubEnv("ENCRYPTION_KEY", "too-short");
    expect(hasEncryptionKey()).toBe(false);
  });
});

describe("maskSecret", () => {
  it("keeps the last two chars behind dots", () => {
    expect(maskSecret("abcdefgh")).toBe("••••••gh");
    expect(maskSecret("")).toBe("");
  });
});
