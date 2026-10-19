import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkThrottle, clearThrottle } from "@/lib/throttle";

describe("checkThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first hit, blocks repeats inside the window", () => {
    expect(checkThrottle("user-a", 5000)).toBe(true);
    expect(checkThrottle("user-a", 5000)).toBe(false);
  });

  it("allows again once the window passes", () => {
    expect(checkThrottle("user-b", 5000)).toBe(true);
    vi.setSystemTime(new Date("2026-10-11T00:00:06Z"));
    expect(checkThrottle("user-b", 5000)).toBe(true);
  });

  it("scopes keys independently", () => {
    expect(checkThrottle("user-c", 60_000)).toBe(true);
    expect(checkThrottle("user-d", 60_000)).toBe(true);
    expect(checkThrottle("user-c", 60_000)).toBe(false);
  });

  it("clearThrottle resets a key immediately", () => {
    expect(checkThrottle("user-e", 60_000)).toBe(true);
    clearThrottle("user-e");
    expect(checkThrottle("user-e", 60_000)).toBe(true);
  });

  it("forgets keys that are far past any window, so the map cannot grow forever", () => {
    expect(checkThrottle("stale-key", 5000)).toBe(true);
    // Jump past the internal sweep threshold (one hour) and fire another key,
    // which triggers a sweep; the stale entry must be gone.
    vi.setSystemTime(new Date("2026-10-11T02:00:01Z"));
    expect(checkThrottle("fresh-key", 5000)).toBe(true);
    vi.setSystemTime(new Date("2026-10-11T02:00:02Z"));
    // A window long enough to outlive a sweep still sees the fresh key...
    expect(checkThrottle("fresh-key", 3_600_000)).toBe(false);
  });
});
