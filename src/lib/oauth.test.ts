import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveUsername, sealOAuthState, unsealOAuthState } from "@/lib/oauth";

describe("OAuth state seal", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips through seal/unseal", () => {
    vi.stubEnv("SESSION_SECRET", "test-secret-that-is-long-enough-for-hmac");
    const payload = JSON.stringify({ provider: "google", state: "abc", codeVerifier: "xyz" });
    const sealed = sealOAuthState(payload);
    expect(sealed).not.toBe(payload);
    expect(unsealOAuthState(sealed)).toBe(payload);
  });

  it("rejects tampered or shapeless cookies", () => {
    vi.stubEnv("SESSION_SECRET", "test-secret-that-is-long-enough-for-hmac");
    const sealed = sealOAuthState("hello");
    const tampered = `${sealed.slice(0, -1)}${sealed.endsWith("0") ? "1" : "0"}`;
    expect(unsealOAuthState(tampered)).toBeNull();
    expect(unsealOAuthState("no-dot-at-all")).toBeNull();
    expect(unsealOAuthState("")).toBeNull();
  });

  it("rejects seals made under a different secret", () => {
    vi.stubEnv("SESSION_SECRET", "first-secret-value-for-hmac-use");
    const sealed = sealOAuthState("hello");
    vi.stubEnv("SESSION_SECRET", "second-secret-value-for-hmac-use");
    expect(unsealOAuthState(sealed)).toBeNull();
  });
});

describe("deriveUsername", () => {
  it("slugifies the seed", async () => {
    expect(await deriveUsername("Rangga Pradipta!", async () => false)).toBe("ranggapradipta");
  });

  it("falls back to user for empty seeds", async () => {
    expect(await deriveUsername("!!!", async () => false)).toBe("user");
  });

  it("suffixes taken names until free", async () => {
    const taken = new Set(["aldo"]);
    const name = await deriveUsername("aldo", async (candidate) => taken.has(candidate));
    expect(name).not.toBe("aldo");
    expect(name.startsWith("aldo")).toBe(true);
  });
});
