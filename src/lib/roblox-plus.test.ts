import { describe, expect, it } from "vitest";
import {
  normalizeRobloxCookie,
  probePlusEligibility,
  type FetchLike,
} from "@/lib/roblox-plus";

/**
 * The probe is the only thing standing between an operator and a wrong verdict,
 * so these tests pin the two properties that matter: it never guesses a signal
 * it could not read, and the cookie it was handed never leaves the request — not
 * in the report, not in the notes, not in a thrown error.
 */
const COOKIE = `_|WARNING:-DO-NOT-SHARE-THIS.|_${"a".repeat(64)}`;

const AUTHENTICATED = {
  id: 4210,
  name: "rangga_pradipta",
  displayName: "Rangga",
};

/** Answers each Roblox route; anything unlisted is treated as absent (404). */
function fakeFetch(routes: Record<string, { status: number; body: unknown }>): FetchLike {
  return async (url) => {
    const key = Object.keys(routes).find((route) => url.includes(route));
    if (!key) return { status: 404, json: async () => ({}) };
    const route = routes[key];
    return { status: route.status, json: async () => route.body };
  };
}

const SESSION = "/v1/users/authenticated";
const PREMIUM = "/validate-membership";
const UPSELL = "/premium-upsell-precheck";
// Matches the legacy route for any account id, and deliberately not the Plus
// access URL, whose namespace reads `namespace=subscriptions%2F…`.
const SUBS = "/subscriptions";
const PLUS_ACCESS = "/upsell-feature-access";
const AGE_GROUP = "/account-insights/age-group";
const VERIFIED_AGE = "/age-verification/verified-age";
const INBOX = "/v1/messages?";

function base(extra: Record<string, { status: number; body: unknown }> = {}) {
  return {
    [SESSION]: { status: 200, body: AUTHENTICATED },
    [PREMIUM]: { status: 200, body: false },
    [UPSELL]: { status: 200, body: { isEligible: false } },
    [SUBS]: { status: 200, body: [] },
    [PLUS_ACCESS]: { status: 200, body: { access: "Actionable", shouldPrompt: false } },
    [AGE_GROUP]: { status: 200, body: { ageGroupTranslationKey: "Label.AgeGroup13To15", isChecked: true, estimatedAge: 14 } },
    [VERIFIED_AGE]: { status: 200, body: { isVerified: false, verifiedAge: 0, isSeventeenPlus: false } },
    [INBOX]: { status: 200, body: { collection: [] } },
    ...extra,
  };
}

describe("normalizeRobloxCookie", () => {
  it("accepts the bare value, the prefixed form, a quoted value and a wrapped one", () => {
    expect(normalizeRobloxCookie(` ${COOKIE} `)).toBe(COOKIE);
    expect(normalizeRobloxCookie(`.ROBLOSECURITY=${COOKIE}`)).toBe(COOKIE);
    expect(normalizeRobloxCookie(`"${COOKIE}"`)).toBe(COOKIE);
    // Copying a long value out of a terminal commonly inserts line breaks.
    expect(normalizeRobloxCookie(`${COOKIE.slice(0, 30)}\n${COOKIE.slice(30)}`)).toBe(COOKIE);
  });

  it("refuses anything too short to be a session", () => {
    expect(normalizeRobloxCookie("")).toBeNull();
    expect(normalizeRobloxCookie("   ")).toBeNull();
    expect(normalizeRobloxCookie(".ROBLOSECURITY=")).toBeNull();
    expect(normalizeRobloxCookie("a".repeat(39))).toBeNull();
  });
});

describe("probePlusEligibility", () => {
  it("reads a rejected session as a verdict, not as a failure", async () => {
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(base({ [SESSION]: { status: 401, body: {} } })),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.verdict).toBe("sesi_tidak_valid");
    expect(result.report.account).toBeNull();
    expect(result.report.notes.join(" ")).toContain("HTTP 401");
  });

  it("reports a failure only when Roblox itself could not be reached", async () => {
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("roblox_tidak_terbaca");
    expect(result.detail).not.toContain(COOKIE);
  });

  it("stays at 'no signal' when every route answers but none of them is positive", async () => {
    const result = await probePlusEligibility({ cookie: COOKIE, fetchImpl: fakeFetch(base()) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.verdict).toBe("tidak_ada_sinyal");
    expect(result.report.signals).toEqual({
      premium: "tidak",
      upsellPrecheck: "tidak",
      subscriptionRows: "tidak",
      plusPrompt: "tidak",
    });
  });

  it("flags an inbox message that reads like the trial offer", async () => {
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(
        base({
          [INBOX]: {
            status: 200,
            body: {
              collection: [
                {
                  id: 88,
                  subject: "Your free month of Roblox Plus",
                  body: "Claim your 1-month Plus trial.",
                  sent: "2026-04-30T07:00:00Z",
                },
                { id: 89, subject: "Maintenance", body: "Roblox will be down.", sent: "2026-05-01T07:00:00Z" },
              ],
            },
          },
        }),
      ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.verdict).toBe("kemungkinan_eligible");
    expect(result.report.offers).toEqual([
      { id: 88, subject: "Your free month of Roblox Plus", sentAt: "2026-04-30T07:00:00Z", trialMention: true },
    ]);
  });

  it("takes the landing page's own answer as the strongest signal", async () => {
    // Captured live: the Plus landing calls this route and renders "Try it for
    // free" when it answers shouldPrompt: true. The old precheck route said the
    // same thing about an account that had no offer at all.
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(
        base({ [PLUS_ACCESS]: { status: 200, body: { access: "Actionable", shouldPrompt: true } } }),
      ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.verdict).toBe("kemungkinan_eligible");
    expect(result.report.signals.plusPrompt).toBe("ya");
    expect(result.report.plusAccess).toEqual({ access: "Actionable", shouldPrompt: true });
    expect(result.report.notes.join(" ")).toContain("Try it for free");
    // The weak "precheck only means not subscribed" caveat must not fire here:
    // it would contradict the line above it in the same report.
    expect(result.report.notes.join(" ")).not.toContain('kemungkinan hanya berarti "belum berlangganan"');
  });

  it("says the offer is not active when Roblox answers shouldPrompt false", async () => {
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(base()),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.signals.plusPrompt).toBe("tidak");
    expect(result.report.notes.join(" ")).toContain("tidak menawarkan Plus ke akun ini saat dibaca");
  });

  it("separates the age group Roblox estimated from a verified government ID", async () => {
    // Both shapes came off a live account on 2026-10-16: a group of Over21 that
    // Roblox checked by facial estimate while the ID route was never used.
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(
        base({
          [AGE_GROUP]: {
            status: 200,
            body: {
              ageGroupTranslationKey: "Label.AgeGroupOver21",
              isChecked: true,
              estimatedAge: 44,
              estimatedAgeGroupTranslationKey: "Label.AgeGroupOver21Estimated",
            },
          },
        }),
      ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.age).toEqual({
      groupKey: "Label.AgeGroupOver21",
      checked: true,
      estimatedAge: 44,
      idVerified: false,
    });
    expect(result.report.notes.join(" ")).toContain("verifikasi ID pemerintah belum dilakukan");
    // Age is context, not evidence for the Plus verdict.
    expect(result.report.verdict).toBe("tidak_ada_sinyal");
  });

  it("keeps an unreadable age route out of both the verdict and the notes' claims", async () => {
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(base({ [AGE_GROUP]: { status: 500, body: {} }, [VERIFIED_AGE]: { status: 500, body: {} } })),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.age).toEqual({ groupKey: null, checked: null, estimatedAge: null, idVerified: null });
    expect(result.report.notes.join(" ")).toContain("Status verifikasi usia tidak terbaca");
  });

  it("says out loud when an upsell precheck is the only signal it has", async () => {
    // The real shape of a live account read through the panel: valid session, no
    // Premium, precheck true. Calling that "trial available" would be the panel
    // overselling its own evidence, so the note has to contradict the verdict.
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(base({ [UPSELL]: { status: 200, body: { isEligible: true } } })),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.verdict).toBe("kemungkinan_eligible");
    expect(result.report.notes.join(" ")).toContain('kemungkinan hanya berarti "belum berlangganan"');
  });

  it("treats an active Premium as a signal while saying the offer itself was not found", async () => {
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(base({ [PREMIUM]: { status: 200, body: true } })),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.verdict).toBe("kemungkinan_eligible");
    expect(result.report.notes.join(" ")).toContain("tidak ada tawaran trial di inbox");
  });

  it("keeps an unreadable route as 'tidak_terbaca' instead of assuming the answer", async () => {
    const result = await probePlusEligibility({
      cookie: COOKIE,
      fetchImpl: fakeFetch(
        base({
          [PREMIUM]: { status: 500, body: {} },
          [INBOX]: { status: 500, body: {} },
        }),
      ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.signals.premium).toBe("tidak_terbaca");
    expect(result.report.verdict).toBe("tidak_ada_sinyal");
    expect(result.report.notes.join(" ")).toContain("Inbox tidak terbaca (HTTP 500)");
  });

  it("shouts when the session belongs to a different account than the one typed", async () => {
    const result = await probePlusEligibility({
      cookie: COOKIE,
      expectedUsername: "akun_lain",
      fetchImpl: fakeFetch(base()),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.usernameMatches).toBe(false);
    expect(result.report.notes.join(" ")).toContain("bukan akun_lain");
  });

  it("never lets the cookie reach the report", async () => {
    const result = await probePlusEligibility({ cookie: COOKIE, fetchImpl: fakeFetch(base()) });

    expect(JSON.stringify(result)).not.toContain(COOKIE);
    expect(JSON.stringify(result)).not.toContain("WARNING:-DO-NOT-SHARE-THIS");
  });
});
