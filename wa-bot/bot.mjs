/* eslint-disable react-hooks/rules-of-hooks -- this is a Node script, not a
   React component: Baileys' `useMultiFileAuthState` merely borrows the `use*`
   naming convention and is not a React hook. */
/**
 * Blox Astra WhatsApp bot (Baileys) — self-hosted sender for profile OTPs.
 *
 * Runs as its own PM2 process ("bloxastra-wa") next to the web app. It:
 *   1. connects to WhatsApp using a multi-file auth state in ./auth (scan the
 *      printed QR once with the dedicated bot number), and
 *   2. exposes a tiny localhost-only HTTP endpoint the web app calls to send
 *      one message.
 *
 * Why a separate process: the Next.js web app must never depend on a WA
 * socket being up (requests would hang), and Baileys' session files cannot be
 * bundled into the serverless-style Next runtime.
 *
 * Security: the HTTP server binds 127.0.0.1 only and requires the shared
 * bearer token WA_BOT_TOKEN. It will refuse to start without that token.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// PM2 starts this as a plain Node script, which — unlike Next.js — does NOT
// load .env by itself. Without this the bot never sees WA_BOT_TOKEN and
// refuses to start. Node 20.6+ has process.loadEnvFile; anything older falls
// back to a tiny inline parser. Real env vars (set in PM2's `env`) win.
const ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(ENV_PATH)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(ENV_PATH);
  } else {
    const { readFileSync } = await import("node:fs");
    for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
      const match = /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const key = match[1];
      if (process.env[key] !== undefined) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "auth");
const PORT = Number(process.env.WA_BOT_PORT ?? 3140);
const TOKEN = process.env.WA_BOT_TOKEN ?? "";
const PAIRING_NUMBER = process.env.WA_BOT_PAIRING_NUMBER ?? ""; // e.g. 62812xxxxxxx

if (!TOKEN) {
  console.error("[wa-bot] WA_BOT_TOKEN is required — refusing to start.");
  process.exit(1);
}
if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });

// Send-only bot: Baileys' internal logger spams "failed to decrypt message"
// for inbound group traffic we never read, so default it to silent. Our own
// console.log lines above are unaffected. Override with WA_BOT_LOG_LEVEL.
const logger = pino({ level: process.env.WA_BOT_LOG_LEVEL ?? "silent" });

/** @type {import('@whiskeysockets/baileys').WASocket | null} */
let sock = null;
let connected = false;
let pairingRequested = false;

/** Normalize "08xx"/"8xx"/"628xx" to the "628xx@s.whatsapp.net" JID. */
function toJid(raw) {
  const digits = String(raw).replace(/\D/g, "");
  let msisdn = digits;
  if (msisdn.startsWith("0")) msisdn = `62${msisdn.slice(1)}`;
  else if (msisdn.startsWith("8")) msisdn = `62${msisdn}`;
  if (!/^62\d{9,13}$/.test(msisdn)) return null;
  return `${msisdn}@s.whatsapp.net`;
}

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    // Desktop Chrome is the least likely to be flagged as a bot client.
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // PM2 prefixes every stdout line with "3|bloxastr |", which chops the
      // QR into unreadable slices. Write it to a plain file (no prefix) and
      // tell the user where to look; also print a tiny fallback.
      const qrcode = await import("qrcode-terminal");
      const QR_FILE = path.join(__dirname, "qr.txt");
      const lines = [];
      qrcode.default.generate(qr, { small: true }, (ascii) => lines.push(ascii));
      const payload = lines.join("\n");
      const { writeFileSync } = await import("node:fs");
      writeFileSync(QR_FILE, payload, "utf8");
      console.log(`[wa-bot] QR written to ${QR_FILE} — open it (Notepad) and scan.`);
      console.log(`[wa-bot] or open this raw string in a QR generator: ${qr}`);
    }

    if (connection === "open") {
      connected = true;
      console.log("[wa-bot] connected to WhatsApp");
    }

    if (connection === "close") {
      connected = false;
      const code = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : 0;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.warn(`[wa-bot] connection closed (code ${code}); loggedOut=${loggedOut}`);
      if (loggedOut) {
        // Session invalidated (unlinked in the phone app) or a stale/corrupt
        // auth dir. Wipe it and reconnect so a fresh QR is emitted — exiting
        // here instead caused a PM2 restart storm (↺ climbing forever).
        console.error("[wa-bot] session invalid — wiping wa-bot/auth, a new QR will appear.");
        try {
          const { rmSync } = await import("node:fs");
          rmSync(AUTH_DIR, { recursive: true, force: true });
          mkdirSync(AUTH_DIR, { recursive: true });
        } catch (err) {
          console.error("[wa-bot] could not wipe auth dir:", err?.message ?? err);
        }
      }
      // Back off briefly then reconnect (fresh QR after a wipe).
      setTimeout(() => void startSocket(), 5000);
    }

    // Pairing-code flow: request the code ONLY once the socket is live (on the
    // first `qr`), never before connect — calling it early gave
    // "Connection Closed". Still printed as an alternative to scanning.
    if (qr && PAIRING_NUMBER && !state.creds.registered && !pairingRequested) {
      pairingRequested = true;
      try {
        const code = await sock.requestPairingCode(PAIRING_NUMBER.replace(/\D/g, ""));
        console.log(`[wa-bot] PAIRING CODE (enter in WhatsApp > Linked devices): ${code}`);
      } catch (err) {
        console.error("[wa-bot] failed to request pairing code:", err?.message ?? err);
        pairingRequested = false; // allow a retry on the next QR
      }
    }
  });
}

/** Send one text. Throws with a short message the web app can log. */
async function sendMessage(to, message) {
  if (!sock || !connected) throw new Error("wa_not_connected");
  const jid = toJid(to);
  if (!jid) throw new Error("invalid_phone");
  await sock.sendMessage(jid, { text: message });
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/send") {
    res.writeHead(404).end();
    return;
  }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401).end();
    return;
  }
  // Read the body (small; 8kb cap is plenty for one OTP message).
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8192) {
      res.writeHead(413).end();
      return;
    }
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400).end(JSON.stringify({ ok: false, error: "bad_json" }));
    return;
  }
  try {
    await sendMessage(body?.to, body?.message);
    console.log("[wa-bot] sent");
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
  } catch (err) {
    const reason = err instanceof Error ? err.message : "send_failed";
    console.error("[wa-bot] send failed:", reason);
    res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: reason }));
  }
});

// Loopback-only: the web app is on the same machine, nothing else may reach it.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[wa-bot] HTTP listening on 127.0.0.1:${PORT}`);
});

void startSocket();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`[wa-bot] ${signal} — shutting down`);
    server.close();
    process.exit(0);
  });
}