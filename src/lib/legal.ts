/**
 * The facts the policy pages assert about Blox Astra.
 *
 * Everything here was read out of the codebase, not invented: the data
 * categories come from `prisma/schema.prisma`, the escrow windows from
 * `DEFAULT_TIMEOUTS` in `lib/sweep.ts`, the payment methods from
 * `PAYMENT_METHODS` in `lib/payments.ts`, and the security measures from
 * `lib/credentials.ts`, `lib/session.ts` and `lib/oauth.ts`.
 *
 * The operator block comes from `LEGAL_OPERATOR_*` environment variables (see
 * `.env.example`). Code cannot know the legal entity, its address, or the
 * address a consumer complaint should go to, so rather than print a made-up
 * company, every empty field renders as a visible "belum diisi" item on the
 * policy pages. Fill the env vars and that notice disappears on its own,
 * without a deploy — the pages that print these fields call `connection()`,
 * so editing `.env` and restarting the app (`pm2 restart bloxastra-web`) is
 * enough for a change to take effect.
 */

import { DEFAULT_TIMEOUTS } from "@/lib/sweep";
import { TIER_DAILY_CAPS } from "@/lib/order-meta";

export interface OperatorField {
  key: keyof typeof OPERATOR;
  label: string;
  /** why the page cannot ship without it */
  why: string;
}

export const OPERATOR = {
  /** Legal entity behind the service. */
  entity: process.env.LEGAL_OPERATOR_ENTITY?.trim() || "AstraFlow Digital",
  /** Registered address — required in a consumer complaint channel. */
  address: process.env.LEGAL_OPERATOR_ADDRESS?.trim() || "",
  /** Consumer complaint address. PP 80/2019 Pasal 27 requires one be published. */
  email: process.env.LEGAL_OPERATOR_EMAIL?.trim() || "",
  /** Consumer complaint phone number. Also required by Pasal 27. */
  phone: process.env.LEGAL_OPERATOR_PHONE?.trim() || "",
  /** Electronic System Provider registration number (PP 71/2019 Pasal 6). */
  pseNumber: process.env.LEGAL_OPERATOR_PSE_NUMBER?.trim() || "",
  /** Minimum age a user must be to hold an account. */
  minAge: process.env.LEGAL_OPERATOR_MIN_AGE?.trim() || "13 tahun",
};

export const OPERATOR_FIELDS: OperatorField[] = [
  {
    key: "address",
    label: "Alamat terdaftar",
    why: "Layanan pengaduan konsumen wajib mencantumkan alamat.",
  },
  {
    key: "email",
    label: "Alamat pengaduan konsumen",
    why: "PP 80/2019 Pasal 27 mewajibkan alamat pengaduan yang bisa dihubungi.",
  },
  {
    key: "phone",
    label: "Nomor telepon pengaduan",
    why: "Layanan pengaduan konsumen wajib mencantumkan nomor kontak.",
  },
  {
    key: "pseNumber",
    label: "Nomor tanda daftar PSE",
    why: "Penyelenggara sistem elektronik swasta wajib mendaftar sebelum dipakai pengguna.",
  },
];

/** Fields still needing an answer from the operator. */
export function missingOperatorFields(): OperatorField[] {
  return OPERATOR_FIELDS.filter((field) => !OPERATOR[field.key].trim());
}

/** Date these pages last changed — a privacy notice must show this. */
export const LEGAL_UPDATED = "12 Oktober 2026";

/** The privacy page was rewritten on its own schedule; keep its date separate. */
export const PRIVACY_UPDATED = "19 Oktober 2026";

// ───────────────────────────── mechanics, from code ─────────────────────────────

/** Payment methods and their gateway fees, mirroring `PAYMENT_METHODS`. */
export const PAYMENT_METHODS_LEGAL = [
  { label: "QRIS", fee: "tanpa biaya tambahan" },
  { label: "Virtual Account (BCA, BNI, Mandiri, BRI)", fee: "Rp 4.000" },
  { label: "E-wallet (GoPay, OVO, DANA)", fee: "Rp 2.500" },
  { label: "Saldo dompet Blox Astra", fee: "tanpa biaya tambahan" },
];

/** Withdrawal fee, mirroring the `Withdrawal.fee` default. */
export const WITHDRAWAL_FEE = "Rp 2.500";

/**
 * Escrow windows actually enforced by the sweep job, read straight from it.
 * Copying the numbers here would have meant a policy that quietly stops being
 * true the first time an admin retunes `sweep.timeouts`.
 *
 * The confirmation window is not among them: it is per listing
 * (`Product.autoReleaseHours`, default 24) and is shown on the order page, so
 * the policy describes it by reference instead of asserting a fixed number.
 */
export const ESCROW_WINDOWS = {
  poolHours: DEFAULT_TIMEOUTS.poolHours,
  assignedHours: DEFAULT_TIMEOUTS.assignedHours,
  processingDays: DEFAULT_TIMEOUTS.processingDays,
  /** Admin arbitrates a dispute inside this window. */
  disputeSlaHours: 24,
};

/** Retention periods required of e-commerce operators (PP 80/2019 Pasal 25). */
export const RETENTION = {
  financial: "10 tahun",
  nonFinancial: "5 tahun",
  otpMinutes: 5,
};

/**
 * Seller tiers, with the daily ceilings the dashboard and onboarding read from
 * `TIER_DAILY_CAPS`. The About page shows the caps, so it imports them rather
 * than restating them — a policy that quotes a limit the product no longer
 * enforces is worse than one that names none.
 */
export const SELLER_TIERS = [
  { tier: 1 as const, note: "Plafon harian paling rendah sampai toko terbukti." },
  { tier: 2 as const, note: "Buka akses rebutan orderan pool, yang tidak terbuka di Tier 1." },
  { tier: 3 as const, note: "Plafon tertinggi untuk toko dengan rekam jejak terbaik." },
].map((entry) => ({ ...entry, dailyCap: TIER_DAILY_CAPS[entry.tier] }));

/** Roblox's own account requirements, which this platform depends on. */
export const OFFSITE = {
  robloxNotAffiliated:
    "Blox Astra bukan produk resmi Roblox Corporation dan tidak berafiliasi dengan mereka. Robux dan Roblox adalah merek dagang Roblox Corporation.",
};
