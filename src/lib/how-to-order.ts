/**
 * The copy for the home page's "Cara pesan" band, as data.
 *
 * Kept out of the component for the same reason `landing-signals.ts` is kept
 * out of `landing.ts`: the numbers in this copy are the ones the sweep job
 * actually enforces, so they have to arrive as arguments rather than as
 * literals typed into JSX. A promise that says "dana kembali dalam 3 hari"
 * while `sweep.timeouts.assignedHours` says 72 is worse than no promise.
 *
 * Nothing here is invented, and nothing here is a slogan:
 *
 *   - the refund windows and the dispute SLA come from `lib/legal.ts`, which
 *     reads them from `DEFAULT_TIMEOUTS` in `lib/sweep.ts`;
 *   - the credential window comes from `CREDENTIAL_WIPE_DAYS` in the same file,
 *     which is the constant the wipe job itself uses;
 *   - the confirmation window is per listing (`Product.autoReleaseHours`), so
 *     this copy points at the order page instead of asserting a number that
 *     belongs to the seller's listing.
 *
 * This module is deliberately pure — it takes no imports at all — so a unit
 * test can drive it with different windows and prove the numbers really are
 * interpolated rather than hardcoded.
 */

export interface HowToOrderWindows {
  /** hours a paid pool order may sit unclaimed before the buyer is refunded */
  poolHours: number;
  /** hours a paid, assigned order may sit unstarted before the buyer is refunded */
  assignedHours: number;
  /** days a processing order may sit untouched before the buyer is refunded */
  processingDays: number;
  /** hours an admin has to arbitrate an open dispute */
  disputeSlaHours: number;
  /** days after completion that the buyer's credentials are wiped */
  credentialWipeDays: number;
}

export interface HowToOrderStep {
  /** two-digit sequence marker, shown as the step's ordinal */
  no: string;
  title: string;
  /** what actually happens, in the order it happens */
  body: string;
  /** the one detail worth pulling out of the body */
  fact: string;
}

export interface HowToOrderDoubt {
  q: string;
  a: string;
}

export interface HowToOrderCopy {
  steps: HowToOrderStep[];
  doubts: HowToOrderDoubt[];
}

/**
 * The three steps every order on this platform takes, in order.
 *
 * No windows here: the steps describe the route, and the one deadline that
 * changes per listing (the confirmation window) belongs to the seller's listing,
 * so the copy points at the order page rather than asserting a number. The
 * deadlines that the platform itself enforces all live in `howToOrderDoubts`.
 */
export function howToOrderSteps(): HowToOrderStep[] {
  return [
    // Bodies are held near two short lines on a phone: this band is the first
    // thing after the hero, and it cannot push the shop off the second screen.
    // The specifics live in `fact`, where they read as a detail line instead of
    // lengthening the paragraph.
    {
      no: "01",
      title: "Pilih metode dan nominalnya",
      body: "Username, login, atau gamepass — pilih yang paling cocok buat akunmu, lalu tentukan nominalnya.",
      fact: "Bayar lewat QRIS, VA, e-wallet, atau saldo dompet",
    },
    {
      no: "02",
      title: "Bayar, dan uang berhenti di platform",
      body: "Dana pembayaranmu ditahan platform. Penjual belum bisa menariknya sebelum barangnya sampai.",
      fact: "Dana ditahan, belum jadi milik penjual",
    },
    {
      no: "03",
      title: "Barang masuk, baru dana dilepas",
      body: "Penjual menyerahkan Robux atau itemnya, kamu periksa lalu konfirmasi.",
      fact: "Bukan penjual yang melepasnya — konfirmasimu, atau jendela di halaman pesanan",
    },
  ];
}

/**
 * The three doubts that actually stop a first-time buyer on this page — money
 * that never comes back, credentials, and a delivery that does not match — each
 * answered with the mechanism, not with reassurance.
 */
export function howToOrderDoubts(windows: HowToOrderWindows): HowToOrderDoubt[] {
  return [
    {
      q: "Kalau penjual tidak mengirim barangnya?",
      a: `Pesanan yang tidak bergerak dikembalikan otomatis oleh tugas terjadwal: ${windows.assignedHours} jam setelah diambil penjual tapi belum dimulai, ${windows.processingDays} hari kalau macet, dan ${windows.poolHours} jam kalau tidak ada penjual yang mengambil. Tanpa perlu kamu tagih.`,
    },
    {
      q: "Kalau aku memakai jalur login?",
      a: `Data login dienkripsi sebelum disimpan, lalu dihapus permanen ${windows.credentialWipeDays} hari setelah pesanan selesai. Hanya penjual yang menangani pesananmu yang bisa membukanya, dan tiap pembukaan tercatat.`,
    },
    {
      q: "Kalau barangnya tidak sesuai?",
      a: `Buka sengketa dari halaman pesanan. Selama sengketa berjalan dananya dibekukan — tidak ada pihak yang bisa menariknya — dan admin memutuskan dalam ${windows.disputeSlaHours} jam: uang kembali penuh atau diteruskan ke penjual.`,
    },
  ];
}

export function howToOrder(windows: HowToOrderWindows): HowToOrderCopy {
  return { steps: howToOrderSteps(), doubts: howToOrderDoubts(windows) };
}
