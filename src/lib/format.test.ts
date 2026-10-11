import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDateTime,
  formatDuration,
  formatIDR,
  formatIDRCompact,
  formatNumber,
  gamepassPriceForNet,
  netRobuxForGamepassPrice,
  relativeFromNow,
  secondsUntil,
  seedFraction,
  slugify,
} from "@/lib/format";

describe("formatIDR", () => {
  it("renders whole rupiah with dot thousands", () => {
    expect(formatIDR(145000)).toBe("Rp 145.000");
    expect(formatIDR(0)).toBe("Rp 0");
  });

  it("rounds fractional input", () => {
    expect(formatIDR(999.6)).toBe("Rp 1.000");
  });
});

describe("formatIDRCompact", () => {
  it("compacts millions and thousands", () => {
    expect(formatIDRCompact(500_000)).toBe("Rp 500rb");
    expect(formatIDRCompact(1_400_000)).toBe("Rp 1,4jt");
  });

  it("promotes 999.5rb to jutaan instead of printing Rp 1000rb", () => {
    expect(formatIDRCompact(999_500)).toBe("Rp 1jt");
    expect(formatIDRCompact(999_499)).toBe("Rp 999rb");
  });

  it("keeps the sign outside", () => {
    expect(formatIDRCompact(-1500)).toBe("-Rp 2rb");
    expect(formatIDRCompact(999)).toBe("Rp 999");
  });
});

describe("formatNumber", () => {
  it("groups thousands with dots", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
  });
});

describe("gamepass tax roundtrip", () => {
  it("never delivers less than the quoted net", () => {
    for (const net of [1, 7, 100, 500, 1000, 10000]) {
      expect(netRobuxForGamepassPrice(gamepassPriceForNet(net))).toBe(net);
    }
  });

  it("rounds the asset price up", () => {
    expect(gamepassPriceForNet(100)).toBe(143);
    expect(gamepassPriceForNet(0)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("renders s, m s and h m shapes", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(47)).toBe("47s");
    expect(formatDuration(754)).toBe("12m 34s");
    expect(formatDuration(7380)).toBe("2j 3m");
    expect(formatDuration(-5)).toBe("0s");
  });
});

describe("formatClock", () => {
  it("zero-pads HH:MM:SS", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock(8999)).toBe("02:29:59");
  });
});

describe("formatDateTime", () => {
  it("renders Asia/Jakarta wall time regardless of host TZ", () => {
    // 2026-10-11T00:00:00Z == 07:00 WIB on 11 Okt
    const text = formatDateTime("2026-10-11T00:00:00Z");
    expect(text).toContain("11 Okt");
    expect(text).toContain("07.00");
  });
});

describe("relativeFromNow / secondsUntil", () => {
  it("counts down in whole seconds and ends at berakhir", () => {
    expect(secondsUntil("2026-10-11T00:01:40Z", new Date("2026-10-11T00:00:00Z").getTime())).toBe(100);
    expect(relativeFromNow("2026-10-11T00:00:00Z", new Date("2026-10-11T00:01:00Z").getTime())).toBe(
      "berakhir",
    );
  });
});

describe("slugify", () => {
  it("lowercases, dashes runs, trims edges", () => {
    expect(slugify("Vault Nusantara!!")).toBe("vault-nusantara");
    expect(slugify("  A  B  ")).toBe("a-b");
    expect(slugify("robux_1000")).toBe("robux-1000");
  });
});

describe("seedFraction", () => {
  it("is deterministic, bounded, and salt-sensitive", () => {
    const first = seedFraction("bx-abc");
    expect(seedFraction("bx-abc")).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(seedFraction("bx-abc", 7)).not.toBe(first);
  });
});
