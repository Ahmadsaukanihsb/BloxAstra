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
});
