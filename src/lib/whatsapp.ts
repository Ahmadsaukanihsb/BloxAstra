import "server-only";

/**
 * WhatsApp OTP delivery. Production sends via Fonnte (`FONNTE_TOKEN`);
 * without a token the flow runs in sim mode — the code is returned to the
 * caller so demo/testing still works, and production refuses cleanly instead
 * of pretending a message was sent.
 */

export function isWhatsappSimMode(): boolean {
  return !process.env.FONNTE_TOKEN;
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

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: process.env.FONNTE_TOKEN as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: phone,
        message: `Kode verifikasi Blox Astra: ${code}. Berlaku 5 menit. Jangan bagikan ke siapa pun.`,
      }),
    });
    if (!res.ok) {
      console.error("sendWhatsappOtp failed", res.status, await res.text().catch(() => ""));
      return { sent: false, sim: false, error: "Gagal mengirim pesan WhatsApp." };
    }
    return { sent: true, sim: false };
  } catch (error) {
    console.error("sendWhatsappOtp failed", error);
    return { sent: false, sim: false, error: "Gagal menghubungi layanan WhatsApp." };
  }
}
