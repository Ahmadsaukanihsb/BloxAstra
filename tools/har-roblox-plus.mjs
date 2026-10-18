#!/usr/bin/env node
/**
 * HAR analyzer for one question: when a Roblox Plus purchase/claim happens by
 * hand in a browser, is there any request that CREATES the subscription — or
 * does the flow always end on a payment-provider page?
 *
 * Why this exists: the panel can read Roblox's documented cookie-authenticated
 * routes, but no documented or community-reported route creates a subscription.
 * Guessing one would produce invented URLs. A HAR captured during a real,
 * manual purchase answers it with evidence instead.
 *
 * A HAR is a pile of live credentials — every request carries the session
 * cookie, and provider pages carry payment data. So this tool redacts on the way
 * in and only ever prints method, host, path and status:
 *   - `cookie`, `set-cookie`, `authorization`, `x-csrf-token`, and any header
 *     whose name looks like a secret become `<redacted>`
 *   - request bodies are replaced with `<redacted body, N bytes>`
 *   - response bodies are dropped entirely (status/size/mime are kept)
 *   - query values for token-ish parameters are replaced with `<redacted>`
 *     (the claim link Roblox emailed is account-bound, so its token matters)
 *
 * Usage:
 *   node tools/har-roblox-plus.mjs capture.har
 *   node tools/har-roblox-plus.mjs capture.har --out capture.redacted.har
 *   node tools/har-roblox-plus.mjs --self-test
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const SECRET_HEADER = /cookie|set-cookie|authorization|auth|token|csrf|secret|api[-_]?key|session/i;
const SECRET_QUERY = /token|code|offer|promo|auth|key|sig|signature|session|nonce|state/i;
const ROBLOX_HOST = /(^|\.)roblox\.com$|(^|\.)rbxcdn\.com$|(^|\.)robloxlabs\.com$/i;
const PROVIDER_HOST = /paypal|stripe|xsolla|adyen|checkout\.com|braintree|worldpay|2checkout|cybersource/i;
const STATE_CHANGING = /^(POST|PUT|PATCH|DELETE)$/i;
/** Names that look like a subscription/checkout action rather than a read. */
const INTERESTING_PATH = /subscri|premium|plus|membership|billing|checkout|payment|purchase|order|upsell|renew|plan/i;

function redactUrl(raw) {
  try {
    const url = new URL(raw);
    let touched = false;
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_QUERY.test(key)) {
        url.searchParams.set(key, "<redacted>");
        touched = true;
      }
    }
    return touched ? url.toString() : url.toString();
  } catch {
    return raw;
  }
}

function redactEntry(entry) {
  const request = entry.request ?? {};
  const headers = Array.isArray(request.headers) ? request.headers : [];
  const cookies = Array.isArray(request.cookies) ? request.cookies.length : 0;

  return {
    ...entry,
    request: {
      method: request.method,
      url: typeof request.url === "string" ? redactUrl(request.url) : request.url,
      httpVersion: request.httpVersion,
      headersSize: request.headersSize,
      bodySize: request.bodySize,
      headers: headers.map((header) => ({
        name: header.name,
        value: SECRET_HEADER.test(header.name ?? "") ? "<redacted>" : header.value,
      })),
      // Cookie jars and posted forms are where the long-lived tokens live.
      cookies: cookies ? [{ name: "<redacted>", value: "<redacted>" }] : [],
      queryString: Array.isArray(request.queryString)
        ? request.queryString.map((pair) =>
            SECRET_QUERY.test(pair.name ?? "")
              ? { name: pair.name, value: "<redacted>" }
              : pair,
          )
        : [],
      postData:
        request.postData !== undefined
          ? { mimeType: request.postData?.mimeType, text: `<redacted body, ${(request.postData?.text ?? "").length} bytes>` }
          : undefined,
    },
    response: {
      status: entry.response?.status,
      statusText: entry.response?.statusText,
      bodySize: entry.response?.bodySize,
      headers: (entry.response?.headers ?? []).map((header) => ({
        name: header.name,
        value: SECRET_HEADER.test(header.name ?? "") ? "<redacted>" : header.value,
      })),
      content: entry.response?.content
        ? { mimeType: entry.response.content.mimeType, size: entry.response.content.size }
        : undefined,
      redirectURL: entry.response?.redirectURL ? redactUrl(entry.response.redirectURL) : undefined,
    },
  };
}

function hostOf(raw) {
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return "(unparseable)";
  }
}

function pathOf(raw) {
  try {
    const url = new URL(raw);
    const query = [...url.searchParams.keys()];
    return `${url.pathname}${query.length ? `?${query.map((key) => `${key}=`).join("&")}` : ""}`;
  } catch {
    return raw;
  }
}

export function analyzeHar(har) {
  const entries = har?.log?.entries ?? [];
  const hosts = new Map();
  const candidates = [];

  for (const entry of entries) {
    const request = entry.request ?? {};
    const url = request.url ?? "";
    const host = hostOf(url);
    const isRoblox = ROBLOX_HOST.test(host);
    const isProvider = PROVIDER_HOST.test(host);

    const bucket = hosts.get(host) ?? { total: 0, roblox: isRoblox, provider: isProvider, writes: 0 };
    bucket.total += 1;
    if (STATE_CHANGING.test(request.method ?? "")) bucket.writes += 1;
    hosts.set(host, bucket);

    const candidate =
      (isRoblox && STATE_CHANGING.test(request.method ?? "")) ||
      INTERESTING_PATH.test(url) ||
      isProvider;
    if (candidate) {
      candidates.push({
        method: request.method ?? "?",
        host,
        path: pathOf(url),
        status: entry.response?.status ?? null,
        kind: isProvider ? "provider" : isRoblox ? "roblox" : "other",
      });
    }
  }

  const providerHosts = [...hosts.entries()].filter(([, v]) => v.provider).map(([host]) => host);
  const robloxWrites = [...hosts.entries()]
    .filter(([, v]) => v.roblox && v.writes > 0)
    .reduce((sum, [, v]) => sum + v.writes, 0);

  return { entries: entries.length, hosts, candidates, providerHosts, robloxWrites };
}

function report(summary, harPath) {
  const { entries, hosts, candidates, providerHosts, robloxWrites } = summary;
  const sorted = [...hosts.entries()].sort((a, b) => b[1].total - a[1].total);

  console.log(`HAR: ${harPath} — ${entries} permintaan, ${hosts.size} host\n`);
  console.log("Host yang paling sering disentuh:");
  for (const [host, info] of sorted.slice(0, 15)) {
    const tag = info.provider ? " [provider pembayaran]" : info.roblox ? " [roblox]" : "";
    console.log(`  ${String(info.total).padStart(4)}  ${host}${tag}${info.writes ? ` · ${info.writes} tulisan` : ""}`);
  }

  console.log(`\nTulisan (POST/PUT/PATCH/DELETE) ke host Roblox: ${robloxWrites}`);
  console.log(`Host provider pembayaran: ${providerHosts.length ? providerHosts.join(", ") : "tidak ada"}`);

  console.log("\nKandidat yang perlu diperiksa:");
  if (!candidates.length) console.log("  (tidak ada)");
  for (const item of candidates.slice(0, 40)) {
    console.log(`  ${item.kind.padEnd(8)} ${item.method.padEnd(6)} ${item.status ?? "-"}  ${item.host}${item.path}`);
  }

  console.log(
    "\nCara membaca: kalau ada satu POST ke host Roblox yang namanya menyebut subscription/checkout dan statusnya sukses, " +
      "itu kandidat endpoint pembuat langganan. Kalau semua tulisan berhenti tepat sebelum host provider, " +
      "artinya langkah terakhir memang milik provider dan tidak bisa diotomasi dari server.",
  );
}

const SELF_TEST_HAR = {
  log: {
    entries: [
      {
        request: {
          method: "GET",
          url: "https://www.roblox.com/plus?offer_token=SECRET-OFFER-TOKEN",
          headers: [
            { name: "Cookie", value: ".ROBLOSECURITY=_|WARNING:-DO-NOT-SHARE-THIS.|_FAKE" },
            { name: "Accept", value: "text/html" },
          ],
          cookies: [{ name: ".ROBLOSECURITY", value: "FAKE" }],
          queryString: [{ name: "offer_token", value: "SECRET-OFFER-TOKEN" }],
        },
        response: { status: 200, headers: [{ name: "Set-Cookie", value: ".ROBLOSECURITY=FAKE2" }], content: { mimeType: "text/html", size: 1234, text: "<html>page body</html>" } },
      },
      {
        request: {
          method: "POST",
          url: "https://apis.roblox.com/subscriptions/v1/create",
          headers: [
            { name: "Cookie", value: ".ROBLOSECURITY=FAKE" },
            { name: "x-csrf-token", value: "FAKE-CSRF" },
            { name: "content-type", value: "application/json" },
          ],
          postData: { mimeType: "application/json", text: '{"paymentMethodId":"SECRET-1234"}' },
          cookies: [],
          queryString: [],
        },
        response: { status: 200, content: { mimeType: "application/json", size: 20, text: '{"ok":true}' } },
      },
      {
        request: { method: "GET", url: "https://www.paypal.com/checkoutnow?token=FAKE-PAYPAL-TOKEN", headers: [], cookies: [], queryString: [{ name: "token", value: "FAKE-PAYPAL-TOKEN" }] },
        response: { status: 302, redirectURL: "https://www.paypal.com/agreements/approve?ba_token=FAKE-BA", content: { mimeType: "text/html", size: 0 } },
      },
    ],
  },
};

function selfTest() {
  const summary = analyzeHar(SELF_TEST_HAR);
  const redacted = JSON.stringify(SELF_TEST_HAR.log.entries.map(redactEntry));

  const checks = [
    ["cookie value tidak lolos", !redacted.includes("WARNING:-DO-NOT-SHARE-THIS")],
    ["csrf token tidak lolos", !redacted.includes("FAKE-CSRF")],
    ["token query tidak lolos", !redacted.includes("SECRET-OFFER-TOKEN") && !redacted.includes("FAKE-PAYPAL-TOKEN")],
    ["body request tidak lolos", !redacted.includes("SECRET-1234")],
    ["body respons dibuang", !redacted.includes("page body") && !redacted.includes('{"ok":true}')],
    ["host roblox terdeteksi", summary.hosts.get("apis.roblox.com")?.roblox === true],
    ["provider terdeteksi", summary.providerHosts.includes("www.paypal.com")],
    ["tulisan roblox dihitung", summary.robloxWrites === 1],
    ["kandidat endpoint pembuat langganan terlihat", summary.candidates.some((c) => c.method === "POST" && /subscri/i.test(c.path))],
  ];

  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
    if (!pass) ok = false;
  }
  console.log(`\nself-test: ${ok ? "lulus" : "gagal"}`);
  return ok ? 0 : 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test") || args.length === 0) {
    process.exit(selfTest());
  }

  const harPath = args[0];
  const outIndex = args.indexOf("--out");
  const outPath = outIndex >= 0 ? args[outIndex + 1] : null;

  let har;
  try {
    har = JSON.parse(readFileSync(harPath, "utf8"));
  } catch (error) {
    console.error(`Tidak bisa membaca HAR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  if (outPath) {
    const redacted = { log: { ...har.log, entries: (har.log?.entries ?? []).map(redactEntry) } };
    writeFileSync(outPath, JSON.stringify(redacted, null, 1));
    console.log(`Versi teredaksi ditulis ke ${outPath}\n`);
  }

  report(analyzeHar(har), basename(harPath));
}

main();
