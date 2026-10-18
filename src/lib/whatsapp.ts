import "server-only";

/**
 * WhatsApp OTP delivery.
 *
 * Sending goes to our OWN Baileys bot (the "bloxastra-wa" PM2 process), which
 * listens on 127.0.0.1 and is authenticated with WA_BOT_TOKEN. We never talk
 * to WhatsApp directly from the web app: the WA socket must stay out of the
 * Next runtime, and a dead/absent socket must not hang a request.
 *
 * Sim mode (no WA_BOT_TOKEN) returns the code to the caller for local dev;
 * production refuses it (see actions/whatsapp.ts) so it can never be a
 * self-verify bypass.
 */

export function isWhatsappSimMode(): boolean {
  return !process.env.WA_BOT_TOKEN;
}

/** Normalize Indonesian numbers to msisdn: 08xx / 8xx / 628xx → 628xx. Null when invalid. */
export function normalizeMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let msisdn = digits;
  if (msisdn.startsWith("0")) msisdn = `62${msisdn.slice(1)}`;
  else if (msisdn.startsWith("8")) msisdn = `62${msisdn}`;
  if (!/^62\d{9,13}$/.test(msisdn)) return null;
  return msisdn;
}

export async function sendWhatsappOtp(
  phone: string,
  code: string,
): Promise<{ sent: boolean; sim: boolean; error?: string }> {
  if (isWhatsappSimMode()) {
    console.info(`[whatsapp-sim] OTP ${code} → ${phone}`);
    return { sent: true, sim: true };
  }

  const base = process.env.WA_BOT_URL ?? "http://127.0.0.1:3140";
  // Bounded wait: a missing/hung bot must not stall the server action. The
  // token check in production has already refused the sim path, so a failure
  // here is a real send failure the user can retry.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${base}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WA_BOT_TOKEN as string}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: phone,
        message: `Kode verifikasi Blox Astra: ${code}. Berlaku 5 menit. Jangan bagikan ke siapa pun.`,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("sendWhatsappOtp failed", res.status, await res.text().catch(() => ""));
      const notConnected = res.status === 502;
      return {
        sent: false,
        sim: false,
        error: notConnected
          ? "Bot WhatsApp sedang tidak terhubung. Coba lagi sebentar lagi."
          : "Gagal mengirim pesan WhatsApp.",
      };
    }
    return { sent: true, sim: false };
  } catch (error) {
    console.error("sendWhatsappOtp failed", error);
    return { sent: false, sim: false, error: "Gagal menghubungi layanan WhatsApp." };
  } finally {
    clearTimeout(timer);
  }
}
