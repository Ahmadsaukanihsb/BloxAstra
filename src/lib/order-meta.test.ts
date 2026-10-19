import { describe, expect, it } from "vitest";
import {
  ACTIVE_ORDER_STATES,
  DECIDABLE_DISPUTE_STATES,
  DISPUTE_OPEN_STATE,
  DISPUTE_SELLER_REPLIED_STATE,
  RESOLVED_DISPUTE_STATES,
  isDecidableDispute,
} from "@/lib/order-meta";

/**
 * The admin arbitration queue and the resolveDispute action both read
 * `DECIDABLE_DISPUTE_STATES`. They used to restate the literals, and the queue
 * asked for `open` alone — so the moment a seller replied (status
 * `under_review`) the case vanished from the panel and `resolveDispute` refused
 * it as "already resolved", leaving the escrow frozen with no way out.
 *
 * These tests pin the vocabulary, so a state that can exist cannot be silently
 * left out of the queue again.
 */
describe("dispute states", () => {
  it("treats a replied dispute as still waiting for a decision", () => {
    expect(isDecidableDispute(DISPUTE_SELLER_REPLIED_STATE)).toBe(true);
  });

  it("keeps a freshly opened dispute decidable", () => {
    expect(isDecidableDispute(DISPUTE_OPEN_STATE)).toBe(true);
  });

  it("refuses every decided dispute", () => {
    for (const state of RESOLVED_DISPUTE_STATES) {
      expect(isDecidableDispute(state)).toBe(false);
    }
  });

  it("classifies an unknown state as not decidable", () => {
    expect(isDecidableDispute("")).toBe(false);
    expect(isDecidableDispute("open_pool")).toBe(false);
  });

  it("keeps the dead open_pool status out of the in-progress set", () => {
    // The pool lives on `paid` + sellerId null; nothing writes `open_pool`.
    expect(ACTIVE_ORDER_STATES as readonly string[]).not.toContain("open_pool");
    expect(ACTIVE_ORDER_STATES).toContain("paid");
  });

  it("keeps the decidable and resolved sets disjoint", () => {
    const decidable: readonly string[] = DECIDABLE_DISPUTE_STATES;
    for (const state of decidable) {
      expect(RESOLVED_DISPUTE_STATES as readonly string[]).not.toContain(state);
    }
  });

  it("covers every dispute status the app can write", () => {
    // `open` and `under_review` are written by the room actions; the two
    // resolved states are written by resolveDispute. Anything new has to be
    // added here together with the queue that reads it.
    const everyStatusWritten = [
      ...DECIDABLE_DISPUTE_STATES,
      ...RESOLVED_DISPUTE_STATES,
    ];
    expect(everyStatusWritten).toContain(DISPUTE_OPEN_STATE);
    expect(everyStatusWritten).toContain(DISPUTE_SELLER_REPLIED_STATE);
    expect(everyStatusWritten).toHaveLength(4);
  });
});
