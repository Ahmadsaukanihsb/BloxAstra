/**
 * Roblox Plus trial eligibility probe.
 *
 * Why this file talks to roblox.com directly instead of a "Roblox API": Roblox
 * publishes no endpoint that creates, claims or extends a consumer subscription.
 * Open Cloud only carries a read-only beta route for a *universe's* subscription
 * products, and the Plus purchase prompt is an in-experience engine API. The
 * only honest read is the set of cookie-authenticated routes Roblox's own web
 * frontend calls, and the claim itself stays a human action in a logged-in
 * browser — this module never claims to do more than read.
 *
 * The routes below are documented under `create.roblox.com/docs/cloud/reference/
 * domains/*` as cookie-authenticated GETs, which matters: Roblox's Creator Terms
 * ask that an API be accessed only by the means its documentation describes.
 * `premiumfeatures .../subscriptions` is the one exception — it is legacy and no
 * longer in those docs — so it is treated as a hint, never as the decision.
 *
 * The cookie is a password-equivalent bearer credential. It is accepted as an
 * argument, used for the requests, and never returned, stored, logged or echoed
 * into any field of the report.
 */

const USERS = "https://users.roblox.com";
const PREMIUM_FEATURES = "https://premiumfeatures.roblox.com";
const PRIVATE_MESSAGES = "https://privatemessages.roblox.com";
const ACCESS_MANAGEMENT = "https://apis.roblox.com";

/**
 * The route the Plus landing page itself calls to decide whether to show the
 * offer. Captured from a live logged-in session on 2026-10-16; it answers with
 * `access` plus `shouldPrompt`, and `shouldPrompt: true` is what renders the
 * "Try it for free" button. This is a far better signal than the old
 * `premium-upsell-precheck`, which was only an upsell candidate check and read
 * as eligible for an account that had no offer at all.
 */
const PLUS_ACCESS_PATH =
  "/access-management/v1/upsell-feature-access?featureName=IsRobloxPlusSubscribed&namespace=subscriptions%2FPlusSubscription";

/**
 * Age status, captured from the account-settings page on 2026-10-16. Roblox
 * splits the two things people conflate:
 *   - `account-insights/age-group` is the age GROUP the account sits in, with
 *     `isChecked`, the group key and an estimated age when the estimate ran;
 *   - `age-verification-service/.../verified-age` is whether a government ID
 *     was actually verified (`isVerified`, `verifiedAge`).
 * An account can read "21+ Checked" from facial estimation while ID is not
 * verified at all — which is exactly what the live sample showed.
 */
const AGE_GROUP_PATH = "/user-settings-api/v1/account-insights/age-group";
const VERIFIED_AGE_PATH = "/age-verification-service/v1/age-verification/verified-age";

/** Under the official checkout the trial ran to active Premium subscribers. */
const TRIAL_MENTION = /(trial|free month|gratis|coba|cuma-cuma|claim|klaim)/i;
const PLUS_MENTION = /\bplus\b/i;

export type PlusVerdict = "sesi_tidak_valid" | "tidak_ada_sinyal" | "kemungkinan_eligible";

export const VERDICT_LABEL: Record<PlusVerdict, string> = {
  sesi_tidak_valid: "Sesi tidak valid",
  tidak_ada_sinyal: "Tidak ada sinyal tawaran",
  kemungkinan_eligible: "Kemungkinan eligible",
};

/** One signal is "ya"/"tidak" only when Roblox actually answered it. */
export type SignalState = "ya" | "tidak" | "tidak_terbaca";

export interface PlusOfferMessage {
  id: number;
  subject: string;
  sentAt: string | null;
  /** true when the message reads like a trial offer rather than a Plus notice */
  trialMention: boolean;
}

export interface PlusEligibilityReport {
  verdict: PlusVerdict;
  account: { id: number; username: string; displayName: string } | null;
  /** null when no username was typed or the account could not be read */
  usernameMatches: boolean | null;
  signals: {
    /** premiumfeatures validate-membership */
    premium: SignalState;
    /** premiumfeatures premium-upsell-precheck — weak, kept only for context */
    upsellPrecheck: SignalState;
    /** legacy, undocumented subscriptions route */
    subscriptionRows: SignalState;
    /** access-management IsRobloxPlusSubscribed — what the landing page reads */
    plusPrompt: SignalState;
  };
  /** raw answer from the Plus access route, kept verbatim for the audit trail */
  plusAccess: { access: string | null; shouldPrompt: boolean | null };
  /** age status, reported next to the Plus findings but never part of the verdict */
  age: {
    /** e.g. "Label.AgeGroupOver21" */
    groupKey: string | null;
    checked: boolean | null;
    /** the facial estimate Roblox recorded, when it exists */
    estimatedAge: number | null;
    /** true only when a government ID was verified */
    idVerified: boolean | null;
  };
  offers: PlusOfferMessage[];
  /** what was readable, what was not, and what the verdict does not prove */
  notes: string[];
}

/**
 * A rejected cookie is still an answer from Roblox, so it comes back as a
 * verdict. Only "Roblox itself was unreachable" is a failure — nothing was
 * checked in that case, which is exactly the distinction an operator needs.
 */
export type ProbeResult =
  | { ok: true; report: PlusEligibilityReport }
  | { ok: false; reason: "roblox_tidak_terbaca"; detail: string };

/** The slice of `fetch` this module needs, so tests can inject their own. */
export interface FetchLike {
  (url: string, init: { headers: Record<string, string>; signal: AbortSignal }): Promise<{
    status: number;
    json: () => Promise<unknown>;
  }>;
}

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Accepts what an operator really pastes: the bare value, `.ROBLOSECURITY=value`,
 * a quoted value, or a value wrapped across lines by a terminal. Returns null
 * when nothing usable is left, so the caller can refuse before spending a
 * request. Whitespace is stripped because a cookie cannot contain it.
 */
export function normalizeRobloxCookie(raw: string): string | null {
  let value = raw.trim().replace(/^"|"$/g, "");
  if (value.toLowerCase().startsWith(".roblosecurity=")) {
    value = value.slice(".roblosecurity=".length);
  }
  value = value.replace(/\s+/g, "");
  if (value.length < 40) return null;
  return value;
}

interface Read<T> {
  state: SignalState;
  body: T | null;
  /** HTTP status, or null when the request never completed */
  status: number | null;
}

async function readJson<T>(
  fetchImpl: FetchLike,
  url: string,
  cookie: string,
  timeoutMs: number,
): Promise<Read<T>> {
  try {
    // The cookie is sent from whichever address this server egresses from.
    // Roblox prefers the address the session was created on and may challenge
    // anything else, which surfaces here as a non-2xx status rather than a throw.
    const response = await fetchImpl(url, {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}`, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status < 200 || response.status >= 300) {
      return { state: "tidak_terbaca", body: null, status: response.status };
    }
    return { state: "ya", body: (await response.json()) as T, status: response.status };
  } catch {
    // Deliberately swallowed and reported: a probe that throws would take the
    // whole panel down over one unreadable route. The message never carries the
    // cookie, because only the URL is known here.
    return { state: "tidak_terbaca", body: null, status: null };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Turns a response whose exact shape is not documented into a yes/no. Boolean
 * fields win; anything else stays "tidak_terbaca" rather than guessing a verdict
 * out of an unfamiliar payload.
 */
function booleanish(body: unknown): SignalState {
  if (typeof body === "boolean") return body ? "ya" : "tidak";
  if (!isRecord(body)) return "tidak_terbaca";
  const flags = Object.values(body).filter((value) => typeof value === "boolean");
  if (!flags.length) return "tidak_terbaca";
  return flags.some(Boolean) ? "ya" : "tidak";
}

function offerMessages(body: unknown): PlusOfferMessage[] {
  const collection = isRecord(body) && Array.isArray(body.collection) ? body.collection : [];
  const offers: PlusOfferMessage[] = [];

  for (const entry of collection) {
    if (!isRecord(entry)) continue;
    const subject = typeof entry.subject === "string" ? entry.subject : "";
    const text = `${subject}\n${typeof entry.body === "string" ? entry.body : ""}`;
    if (!PLUS_MENTION.test(text)) continue;
    offers.push({
      id: typeof entry.id === "number" ? entry.id : 0,
      subject: subject || "(tanpa subjek)",
      sentAt: typeof entry.sent === "string" ? entry.sent : null,
      trialMention: TRIAL_MENTION.test(text),
    });
  }
  return offers;
}

/**
 * Reads every signal Roblox will answer for this session and reports what it
 * actually found. The verdict is deliberately the weakest word that fits:
 * "kemungkinan_eligible" means signals fired, not that Roblox confirmed the
 * offer — no route exists that confirms it.
 */
export async function probePlusEligibility({
  cookie,
  expectedUsername,
  fetchImpl = fetch as unknown as FetchLike,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  cookie: string;
  expectedUsername?: string | null;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<ProbeResult> {
  const session = await readJson<unknown>(fetchImpl, `${USERS}/v1/users/authenticated`, cookie, timeoutMs);

  if (session.status === 401 || session.status === 403) {
    return {
      ok: true,
      report: {
        verdict: "sesi_tidak_valid",
        account: null,
        usernameMatches: null,
        signals: {
          premium: "tidak_terbaca",
          upsellPrecheck: "tidak_terbaca",
          subscriptionRows: "tidak_terbaca",
          plusPrompt: "tidak_terbaca",
        },
        plusAccess: { access: null, shouldPrompt: null },
        age: { groupKey: null, checked: null, estimatedAge: null, idVerified: null },
        offers: [],
        notes: [
          `Roblox menolak cookie ini (HTTP ${session.status}). Sesi pelanggan sudah kedaluwarsa, atau cookie-nya bukan milik akun yang dimaksud.`,
        ],
      },
    };
  }
  if (session.state === "tidak_terbaca" || !isRecord(session.body)) {
    return {
      ok: false,
      reason: "roblox_tidak_terbaca",
      detail: session.status === null ? "permintaan tidak selesai" : `HTTP ${session.status}`,
    };
  }


  const id = typeof session.body.id === "number" ? session.body.id : null;
  const username = typeof session.body.name === "string" ? session.body.name : "";
  const displayName = typeof session.body.displayName === "string" ? session.body.displayName : "";
  if (id === null) {
    return { ok: false, reason: "roblox_tidak_terbaca", detail: "sesi tidak membawa id akun" };
  }

  const [premium, upsell, subscriptions, plusAccess, ageGroup, verifiedAge, inbox] = await Promise.all([
    readJson<unknown>(fetchImpl, `${PREMIUM_FEATURES}/v1/users/${id}/validate-membership`, cookie, timeoutMs),
    readJson<unknown>(fetchImpl, `${PREMIUM_FEATURES}/v1/users/${id}/premium-upsell-precheck`, cookie, timeoutMs),
    readJson<unknown>(fetchImpl, `${PREMIUM_FEATURES}/v1/users/${id}/subscriptions`, cookie, timeoutMs),
    readJson<unknown>(fetchImpl, `${ACCESS_MANAGEMENT}${PLUS_ACCESS_PATH}`, cookie, timeoutMs),
    readJson<unknown>(fetchImpl, `${ACCESS_MANAGEMENT}${AGE_GROUP_PATH}`, cookie, timeoutMs),
    readJson<unknown>(fetchImpl, `${ACCESS_MANAGEMENT}${VERIFIED_AGE_PATH}`, cookie, timeoutMs),
    readJson<unknown>(
      fetchImpl,
      `${PRIVATE_MESSAGES}/v1/messages?pageNumber=0&pageSize=25&messageTab=Inbox`,
      cookie,
      timeoutMs,
    ),
  ]);

  const offers = offerMessages(inbox.body);
  const subscriptionsState: SignalState =
    subscriptions.state === "tidak_terbaca"
      ? "tidak_terbaca"
      : Array.isArray(subscriptions.body)
        ? subscriptions.body.length
          ? "ya"
          : "tidak"
        : "tidak_terbaca";

  // The Plus answer is a named field, not a bare boolean, so it is read
  // explicitly: `shouldPrompt` decides whether Roblox would offer the trial to
  // this account, and the raw `access` value is carried through untouched.
  const accessRecord = isRecord(plusAccess.body) ? plusAccess.body : null;
  const accessValue = accessRecord && typeof accessRecord.access === "string" ? accessRecord.access : null;
  const shouldPrompt =
    accessRecord && typeof accessRecord.shouldPrompt === "boolean" ? accessRecord.shouldPrompt : null;

  const signals = {
    premium: booleanish(premium.body),
    upsellPrecheck: booleanish(upsell.body),
    subscriptionRows: subscriptionsState,
    plusPrompt: plusAccess.state === "tidak_terbaca" ? ("tidak_terbaca" as const) : shouldPrompt === null ? ("tidak_terbaca" as const) : shouldPrompt ? ("ya" as const) : ("tidak" as const),
  };

  // Age fields are named, so they are read by name; anything missing stays null
  // rather than being guessed from an unfamiliar payload.
  const ageRecord = isRecord(ageGroup.body) ? ageGroup.body : null;
  const verifiedRecord = isRecord(verifiedAge.body) ? verifiedAge.body : null;
  const age = {
    groupKey:
      ageRecord && typeof ageRecord.ageGroupTranslationKey === "string" ? ageRecord.ageGroupTranslationKey : null,
    checked: ageRecord && typeof ageRecord.isChecked === "boolean" ? ageRecord.isChecked : null,
    estimatedAge: ageRecord && typeof ageRecord.estimatedAge === "number" ? ageRecord.estimatedAge : null,
    idVerified: verifiedRecord && typeof verifiedRecord.isVerified === "boolean" ? verifiedRecord.isVerified : null,
  };

  const notes: string[] = [];
  if (age.checked === null && age.idVerified === null) {
    notes.push(
      `Status verifikasi usia tidak terbaca${ageGroup.status ? ` (HTTP ${ageGroup.status})` : ""} — tidak dipakai untuk menilai trial Plus.`,
    );
  } else if (age.checked === true && age.idVerified !== true) {
    notes.push(
      `Usia akun sudah dicek Roblox (grup ${age.groupKey ?? "?"}${age.estimatedAge !== null ? `, estimasi ${age.estimatedAge} tahun` : ""}), tetapi verifikasi ID pemerintah belum dilakukan.`,
    );
  } else if (age.idVerified === true) {
    notes.push(`Akun ini sudah melewati verifikasi ID pemerintah (grup ${age.groupKey ?? "?"}).`);
  }
  if (premium.state === "tidak_terbaca") {
    notes.push(`Cek Premium tidak terbaca${premium.status ? ` (HTTP ${premium.status})` : ""}.`);
  }
  if (upsell.state === "tidak_terbaca") {
    notes.push(`Precheck upsell tidak terbaca${upsell.status ? ` (HTTP ${upsell.status})` : ""}.`);
  }
  if (subscriptions.state === "tidak_terbaca") {
    notes.push("Rute data langganan lama tidak terbaca — tidak dipakai untuk memutuskan.");
  }
  if (inbox.state === "tidak_terbaca") {
    notes.push(`Inbox tidak terbaca${inbox.status ? ` (HTTP ${inbox.status})` : ""} — tawaran trial tidak bisa dipastikan.`);
  }
  if (signals.plusPrompt === "tidak_terbaca") {
    notes.push(
      `Status langganan Plus tidak terbaca${plusAccess.status ? ` (HTTP ${plusAccess.status})` : ""} — kelayakan trial hanya bisa dinilai dari sinyal lain.`,
    );
  } else if (signals.plusPrompt === "ya") {
    notes.push(
      `Roblox menandai akun ini untuk ditawari Plus (access: ${accessValue ?? "?"}, shouldPrompt: true) — inilah sinyal yang memunculkan tombol "Try it for free" di halaman Plus.`,
    );
  } else {
    notes.push(
      `Roblox tidak menawarkan Plus ke akun ini saat dibaca (access: ${accessValue ?? "?"}, shouldPrompt: false) — kemungkinan sudah berlangganan, atau penawaran sedang tidak aktif untuk akun ini.`,
    );
  }

  const trialOffers = offers.filter((offer) => offer.trialMention);
  if (trialOffers.length) {
    notes.push(`${trialOffers.length} pesan inbox terbaca seperti tawaran trial Plus.`);
  } else if (
    signals.upsellPrecheck === "ya" &&
    // Only when nothing stronger spoke. Once the Plus access route answers
    // shouldPrompt: true, the offer IS on the table and this caveat would
    // contradict the note printed right above it.
    signals.plusPrompt !== "ya" &&
    signals.premium !== "ya" &&
    signals.subscriptionRows !== "ya"
  ) {
    // Two live accounts were read through this panel and both looked like this:
    // no Premium, no subscription rows, precheck true. The precheck is an upsell
    // *candidate* check, so on a non-subscriber it most likely just means "not
    // subscribed yet" — treating it as a visible trial would be the panel
    // overselling its own evidence.
    notes.push(
      "Sinyal positif tunggal adalah precheck upsell, dan pada akun tanpa Premium nilai itu kemungkinan hanya berarti \"belum berlangganan\" — bukan tawaran trial yang terbuka. Trial peluncuran Plus dikirim Roblox ke pelanggan Premium aktif, dan tawaran itu tidak terlihat di inbox akun ini.",
    );
  } else if (signals.premium === "ya") {
    notes.push("Premium aktif, tapi tidak ada tawaran trial di inbox. Trial Plus diluncurkan untuk pelanggan Premium aktif, jadi kelayakannya perlu dilihat langsung di halaman Plus.");
  }

  const usernameMatches =
    expectedUsername && expectedUsername.length
      ? expectedUsername.toLowerCase() === username.toLowerCase() ||
        expectedUsername.toLowerCase() === displayName.toLowerCase()
      : null;
  if (usernameMatches === false) {
    notes.push(`Sesi ini milik ${username || "akun lain"}, bukan ${expectedUsername}. Periksa akunnya sebelum lanjut.`);
  }

  const eligibleSignals = trialOffers.length > 0 || Object.values(signals).some((state) => state === "ya");

  notes.push(
    "Tidak ada rute Roblox yang mengklaim trial untuk sebuah akun. Verdict ini hanya sinyal — klik klaim tetap dilakukan pelanggan di browser yang sudah login, karena langganan itu menagih metode pembayaran mereka sendiri setelah masa gratisnya berakhir.",
  );

  return {
    ok: true,
    report: {
      verdict: eligibleSignals ? "kemungkinan_eligible" : "tidak_ada_sinyal",
      account: { id, username, displayName },
      usernameMatches,
      plusAccess: { access: accessValue, shouldPrompt },
      age,
      signals,
      offers,
      notes,
    },
  };
}
