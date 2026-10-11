import { describe, expect, it } from "vitest";
import { maskWebhookUrl, poolKindLabel, validDiscordWebhookUrl } from "@/lib/discord";

describe("validDiscordWebhookUrl", () => {
  it("accepts real channel webhook URLs", () => {
    expect(validDiscordWebhookUrl("https://discord.com/api/webhooks/1234567890/abcDEF_-xyz")).toBe(
      true,
    );
    expect(validDiscordWebhookUrl("https://discordapp.com/api/webhooks/123/abc")).toBe(true);
  });

  it("accepts thread-scoped webhooks", () => {
    expect(validDiscordWebhookUrl("https://discord.com/api/webhooks/123/abc?thread_id=456")).toBe(
      true,
    );
  });

  it("rejects wrong scheme, host, shape and non-strings", () => {
    expect(validDiscordWebhookUrl("http://discord.com/api/webhooks/123/abc")).toBe(false);
    expect(validDiscordWebhookUrl("https://evil.com/api/webhooks/123/abc")).toBe(false);
    expect(validDiscordWebhookUrl("https://discord.com/api/webhooks/abc/token")).toBe(false);
    expect(validDiscordWebhookUrl("https://discord.com/api/webhooks/123/has space")).toBe(false);
    expect(validDiscordWebhookUrl("https://discord.com/channels/123/456")).toBe(false);
    expect(validDiscordWebhookUrl("javascript:alert(1)")).toBe(false);
    expect(validDiscordWebhookUrl("")).toBe(false);
    expect(validDiscordWebhookUrl(null)).toBe(false);
    expect(validDiscordWebhookUrl(undefined)).toBe(false);
  });

  it("rejects oversized input", () => {
    expect(validDiscordWebhookUrl(`https://discord.com/api/webhooks/1/${"a".repeat(600)}`)).toBe(
      false,
    );
  });
});

describe("maskWebhookUrl", () => {
  it("hides everything but the tail", () => {
    const masked = maskWebhookUrl("https://discord.com/api/webhooks/123/secret-token-xyz");
    expect(masked).toContain("…");
    expect(masked).toContain("oken-xyz");
    expect(masked).not.toContain("secret");
  });
});

describe("poolKindLabel", () => {
  it("labels every pool kind and defaults unknown ones", () => {
    expect(poolKindLabel("robux_username")).toBe("Robux via Username");
    expect(poolKindLabel("robux_login")).toBe("Robux via Login");
    expect(poolKindLabel("robux_gamepass")).toBe("Robux via Gamepass");
    expect(poolKindLabel("premium")).toBe("Roblox Premium");
    expect(poolKindLabel("misteri")).toBe("Order Robux");
  });
});
