"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cx } from "@/lib/cx";
import { formatIDR, formatNumber } from "@/lib/format";
import { ROBUX_ORDERS, clampRobuxAmount, robuxOrderPrice } from "@/lib/robux-orders";
import { useRobuxOrder } from "@/components/rates/rate-store";
import { createRobuxOrder } from "@/app/actions/orders";
import {
  LoginRequiredNotice,
  PromoField,
  RobuxMainCta,
  RobuxServiceTabs,
  UsernameVerifyField,
} from "@/components/order/robux-order-shell";
import {
  IconAlert,
  IconCheck,
  IconGlobe,
  IconQrCode,
  IconShieldCheck,
  IconBank,
  IconWallet,
} from "@/components/ui/icons";

/* ─── Constants ─── */

const baseConfig = ROBUX_ORDERS.username;
const MIN_ROBUX = baseConfig.minRobux;
const MAX_ROBUX = baseConfig.maxRobux;

type PaymentMethod = "qris" | "va" | "saldo";
type AgeCategory = "-18" | "+18";

/* ─── Anim variants ─── */
const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/* ─── Main Component ─── */

export function RobuxUsernameOrder({
  isLoggedIn,
  walletBalance = 0,
  initialRobux = baseConfig.initialRobux,
}: {
  isLoggedIn: boolean;
  walletBalance?: number;
  /** Nominal the buyer already picked in the lobby's quick-buy counter. */
  initialRobux?: number;
}) {
  const router = useRouter();
  // Snapped onto this flow's grid so the number in the box is always one a
  // slider value could actually hold.
  const startRobux = clampRobuxAmount(baseConfig, initialRobux);
  const [robux, setRobux] = useState(startRobux);
  const [inputValue, setInputValue] = useState(String(startRobux));
  const [username, setUsername] = useState("");
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifiedAvatar, setVerifiedAvatar] = useState<string | null>(null);

  function handleVerified(name: string | null, avatarUrl?: string | null) {
    setVerifiedName(name);
    setVerifiedAvatar(avatarUrl ?? null);
  }

  const showAvatar =
    verifiedName !== null &&
    verifiedAvatar !== null &&
    verifiedName.toLowerCase() === username.trim().toLowerCase();
  const [ageCategory, setAgeCategory] = useState<AgeCategory>("+18");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qris");
  const [promoCut, setPromoCut] = useState(0);
  const [promoCode, setPromoCode] = useState<string | undefined>(undefined);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const config = useRobuxOrder("username");
  const quickPacks = useMemo(
    () =>
      config.quickPackRobux.map((amount) => ({
        robux: amount,
        price: robuxOrderPrice(config, amount),
      })),
    [config],
  );

  const price = robuxOrderPrice(config, robux);
  const totalPrice = useMemo(() => price + config.adminFee, [price, config.adminFee]);
  const finalPrice = totalPrice - promoCut;
  const sliderPercent = useMemo(
    () => ((robux - MIN_ROBUX) / (MAX_ROBUX - MIN_ROBUX)) * 100,
    [robux],
  );

  function handleRobuxInput(val: string) {
    const num = val.replace(/\D/g, "");
    setInputValue(num);
    const parsed = parseInt(num, 10);
    if (!isNaN(parsed)) {
      setRobux(Math.min(MAX_ROBUX, Math.max(MIN_ROBUX, parsed)));
    }
  }

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    setRobux(val);
    setInputValue(String(val));
  }

  function selectPack(r: number) {
    setRobux(r);
    setInputValue(String(r));
  }

  async function handlePay() {
    const handle = username.trim();
    if (!USERNAME_RE.test(handle)) {
      setPayError("Username Roblox tidak valid (3–20 karakter: huruf, angka, underscore).");
      return;
    }
    if (!verifiedName || verifiedName.toLowerCase() !== handle.toLowerCase()) {
      setPayError("Verifikasi dulu username Roblox dengan tombol Cek.");
      return;
    }
    setPaying(true);
    setPayError(null);
    const result = await createRobuxOrder({
      kind: "username",
      robuxAmount: robux,
      robloxUsername: handle,
      buyerNote: notes.trim() || undefined,
      paymentMethod,
      promoCode: promoCut ? promoCode : undefined,
    });
    if (result.ok) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    setPaying(false);
    if (result.code === "LOGIN") {
      router.push("/masuk");
      return;
    }
    setPayError(result.error);
  }

  return (
    <div className="shell pb-28 pt-24 md:pt-32">
      <RobuxServiceTabs current="username" />

      {/* ─── Main Content Grid ─── */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_390px]">
        {/* ─── Left Column: Wizard Steps ─── */}
        <div className="flex flex-col gap-6">
          {/* ── LANGKAH 1: Pilih Nominal ── */}
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_4px_24px_rgba(23,21,46,0.04)] md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-astra px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                  Langkah 1
                </span>
                <h2 className="font-display text-lg font-extrabold text-ink md:text-title">
                  Pilih Nominal Robux
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="num rounded-full border border-astra/15 bg-astra/[0.06] px-3 py-1 text-[12px] font-bold text-astra-ink">
                  Rate: {formatIDR(config.rate * 100)} / 100
                </span>
              </div>
            </div>

            {/* Info Banner: Langsung Masuk */}
            <div className="mb-6 flex items-center justify-between gap-3 rounded-well border border-success/25 bg-success/[0.06] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full bg-success ring-4 ring-success/25" />
                <span className="text-[12px] font-semibold text-success md:text-[13px]">
                  Via Username: Robux langsung masuk ke akun kamu tanpa pending.
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-success px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-on-bright shadow-xs">
                Langsung Masuk
              </span>
            </div>

            {/* Nominal Headline */}
            <div className="mb-1 eyebrow text-ink-mute">
              Nominal Robux
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="num font-display text-[2.75rem] font-extrabold leading-none tracking-tight text-ink">
                {formatNumber(robux)}
              </span>
              <span className="num rounded-full border border-astra/25 bg-astra/[0.06] px-3.5 py-1 text-[14px] font-extrabold text-astra-ink">
                = {formatIDR(price)}
              </span>
            </div>

            {/* Counter Controls */}
            <div className="mb-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newVal = Math.max(MIN_ROBUX, robux - 100);
                  setRobux(newVal);
                  setInputValue(String(newVal));
                }}
                className="grid size-11 place-items-center rounded-control border border-line bg-canvas text-base font-bold text-ink-dim transition-all hover:bg-canvas-2 hover:text-ink active:scale-95"
                aria-label="Kurangi 100 Robux"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={inputValue}
                onChange={(e) => handleRobuxInput(e.target.value)}
                onBlur={() => setInputValue(String(robux))}
                className="num h-11 w-28 rounded-control border-2 border-line bg-paper px-3 text-center text-base font-extrabold text-ink outline-none transition-all focus:border-astra focus:ring-4 focus:ring-astra/10"
                aria-label="Input nominal Robux"
              />
              <button
                type="button"
                onClick={() => {
                  const newVal = Math.min(MAX_ROBUX, robux + 100);
                  setRobux(newVal);
                  setInputValue(String(newVal));
                }}
                className="grid size-11 place-items-center rounded-control border border-line bg-canvas text-base font-bold text-ink-dim transition-all hover:bg-canvas-2 hover:text-ink active:scale-95"
                aria-label="Tambah 100 Robux"
              >
                +
              </button>
            </div>

            {/* ── Ultra-Smooth Native Range Slider ── */}
            <div className="mb-2 py-2">
              <input
                type="range"
                min={MIN_ROBUX}
                max={MAX_ROBUX}
                step={10}
                value={robux}
                onChange={handleSlider}
                className="smooth-range-slider"
                style={{
                  background: `linear-gradient(to right, var(--color-astra) 0%, var(--color-astra) ${sliderPercent}%, var(--color-line-strong) ${sliderPercent}%, var(--color-line-strong) 100%)`,
                }}
                aria-label="Slider nominal Robux"
              />
            </div>
            <div className="mb-7 flex justify-between text-[11px] font-bold text-ink-mute">
              <span>Min: {formatNumber(MIN_ROBUX)}</span>
              <span>Max: {formatNumber(MAX_ROBUX)}</span>
            </div>

            {/* Quick Preset Packs */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {quickPacks.map((pack) => {
                const isSelected = robux === pack.robux;
                return (
                  <button
                    key={pack.robux}
                    type="button"
                    onClick={() => selectPack(pack.robux)}
                    className={cx(
                      "flex flex-col items-center justify-center gap-0.5 rounded-well border-2 p-3 text-center transition-all duration-200",
                      isSelected
                        ? "border-astra bg-astra/[0.06] ring-2 ring-astra/20"
                        : "border-line bg-paper hover:border-line-strong hover:bg-canvas/70",
                    )}
                  >
                    <span
                      className={cx(
                        "num text-[17px] font-extrabold",
                        isSelected ? "text-astra-ink" : "text-ink",
                      )}
                    >
                      {formatNumber(pack.robux)}
                    </span>
                    <span
                      className={cx(
                        "num text-[11px] font-bold",
                        isSelected ? "text-astra-ink" : "text-ink-mute",
                      )}
                    >
                      {formatIDR(pack.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── LANGKAH 2: Data Akun ── */}
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_4px_24px_rgba(23,21,46,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-astra px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 2
              </span>
              <h2 className="font-display text-lg font-extrabold text-ink md:text-title">
                Data Akun
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-ink-mute">
              Cukup masukkan username Roblox kamu. Robux langsung masuk ke akun tanpa pending dan tanpa memerlukan password.
            </p>

            <div className="mb-6">
              <UsernameVerifyField
                id="roblox-username-input"
                value={username}
                onChange={setUsername}
                verifiedName={verifiedName}
                onVerified={handleVerified}
              />
              <p className="mt-1.5 text-[11px] text-ink-mute">
                Gunakan username Roblox kamu (bukan display name).
              </p>
            </div>

            {/* ── 2-Step Verification (2SV) Warning Box ── */}
            <div className="rounded-well border border-warn/25 bg-warn/[0.06] p-5 shadow-xs">
              <div className="mb-3 flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-control bg-warn/10 text-warn">
                  <IconAlert size={18} />
                </span>
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[13px] font-extrabold text-warn">
                    Akun Roblox Penerima Wajib Menyalakan 2-Step Verification
                  </h3>
                  <span className="rounded bg-warn px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-on-bright">
                    Wajib
                  </span>
                </div>
              </div>

              <p className="mb-4 text-[12px] leading-relaxed text-warn">
                Tanpa Verifikasi 2 Langkah, sistem Roblox hanya mengizinkan 500 Robux masuk per hari dan 1.000 per bulan.
                Dengan 2SV aktif (Email Secure), limit akun kamu melonjak jadi 5.000 Robux per hari dan 10.000 per 30 hari
                (per bulan) sehingga Robux dapat langsung terkirim tanpa tertahan.
              </p>

              <div className="mb-4 rounded-control border border-warn/25 bg-warn/10 p-4">
                <p className="mb-1.5 text-[11px] font-extrabold text-warn">
                  Panduan Mengaktifkan (Cukup 1 kali saja seumur akun):
                </p>
                <p className="font-mono text-[12px] leading-relaxed text-warn">
                  Pengaturan (Settings) → Keamanan (Security) → Verifikasi 2 Langkah →{" "}
                  <span className="font-bold text-info underline underline-offset-2">
                    Pilih Email (Secure)
                  </span>
                </p>
              </div>

              <p className="mb-3.5 text-[11px] text-robux">
                *Pengaturan awal Roblox adalah None (belum aktif). Klik tombol di bawah untuk langsung menuju halaman pengaturan keamanan Roblox:
              </p>

              <a
                href="https://www.roblox.com/my/account#!/security"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-control bg-robux px-4 py-2.5 text-[12px] font-bold text-on-bright shadow-sm transition-[transform,translate,scale,rotate,background-color] hover:bg-warn active:scale-[0.98]"
              >
                Buka Pengaturan Keamanan Roblox
                <IconGlobe size={14} />
              </a>
            </div>

            {/* Age Category Selector */}
            <div className="mt-6">
              <div className="mb-2.5 eyebrow text-ink-mute">
                Kategori Usia Akun Roblox
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["-18", "+18"] as AgeCategory[]).map((age) => {
                  const isSelected = ageCategory === age;
                  return (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setAgeCategory(age)}
                      className={cx(
                        "rounded-well border-2 py-3.5 text-center text-[13px] font-bold transition-all duration-200",
                        isSelected
                          ? "border-astra bg-astra/[0.06] text-astra-ink shadow-xs"
                          : "border-line bg-paper text-ink-dim hover:border-line-strong",
                      )}
                    >
                      {age === "-18" ? "−18 (di bawah 18)" : "+18 (18 ke atas)"}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-ink-mute">
                Robux langsung terkirim tanpa perlu persetujuan email orang tua.
              </p>
            </div>

            {/* Optional Notes */}
            <div className="mt-6">
              <label
                htmlFor="admin-notes"
                className="mb-1.5 block eyebrow text-ink-mute"
              >
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                id="admin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan khusus untuk admin..."
                rows={2}
                className="w-full rounded-well border-2 border-line bg-paper p-3.5 text-[13px] font-medium text-ink outline-none transition-all placeholder:text-ink-mute focus:border-astra focus:ring-4 focus:ring-astra/10"
              />
            </div>
          </div>

          {/* ── LANGKAH 3: Pilih Cara Bayar ── */}
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_4px_24px_rgba(23,21,46,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-astra px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 3
              </span>
              <h2 className="font-display text-lg font-extrabold text-ink md:text-title">
                Pilih Cara Bayar
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-ink-mute">
              Pilih metode pembayaran yang kamu inginkan. Diverifikasi otomatis oleh sistem 24 jam.
            </p>

            {/* Payment Method Tabs */}
            <div className="mb-5 grid grid-cols-3 gap-2.5">
              {[
                { id: "qris" as PaymentMethod, icon: IconQrCode, label: "QRIS" },
                { id: "va" as PaymentMethod, icon: IconBank, label: "Virtual Account" },
                { id: "saldo" as PaymentMethod, icon: IconWallet, label: "Saldo Akun" },
              ].map((method) => {
                const isSelected = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={cx(
                      "flex items-center justify-center gap-2 rounded-well border-2 px-3 py-3.5 text-[12px] font-bold transition-all duration-200",
                      isSelected
                        ? "border-astra bg-paper text-astra-ink"
                        : "border-line bg-paper text-ink-dim hover:border-line-strong",
                    )}
                  >
                    <method.icon size={16} />
                    <span>{method.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Method Details */}
            <AnimatePresence mode="wait">
              {paymentMethod === "qris" ? (
                <motion.div
                  key="qris"
                  {...fadeSlide}
                  className="rounded-well border border-success/25 bg-success/[0.06] p-4 text-success"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success text-on-bright">
                      <IconCheck size={12} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-extrabold">
                        QRIS (Semua Bank & E-Wallet)
                      </span>
                      <p className="text-[12px] leading-relaxed text-success">
                        Dapat dibayar melalui <span className="font-bold">GoPay, OVO, DANA, ShopeePay, LinkAja, BCA Mobile, Livin Mandiri, BRImo, BNI Mobile</span>, dan semua aplikasi perbankan yang mendukung QRIS.
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : paymentMethod === "va" ? (
                <motion.div
                  key="va"
                  {...fadeSlide}
                  className="rounded-well border border-info/25 bg-info/[0.06] p-4 text-info"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-info text-on-bright">
                      <IconCheck size={12} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-extrabold">
                        Virtual Account
                      </span>
                      <p className="text-[12px] leading-relaxed text-info">
                        Transfer melalui nomor VA otomatis ke <span className="font-bold">BCA, BNI, BRI, Mandiri, Permata, CIMB</span>. Verifikasi instan 24 jam.
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="saldo"
                  {...fadeSlide}
                  className="rounded-well border border-info/25 bg-info/[0.06] p-4 text-info"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-info text-on-bright">
                      <IconCheck size={12} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-extrabold">
                        Saldo Akun Blox Astra
                      </span>
                      <p className="text-[12px] leading-relaxed text-info">
                        Potong langsung dari saldo dompet Blox Astra kamu tanpa biaya gateway tambahan.
                      </p>
                      <p className="num text-[12px] font-extrabold text-info">
                        Saldo kamu: {formatIDR(walletBalance)}
                        {walletBalance < finalPrice ? " · kurang, pilih metode lain atau tunggu refund masuk" : " · cukup untuk pesanan ini"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ─── Right Column: Sticky Order Summary ─── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_6px_28px_rgba(23,21,46,0.06)]">
            <div className="flex flex-col gap-5">
              {/* Summary Header */}
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-astra px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  Ringkasan
                </span>
                <h3 className="font-display text-base font-extrabold text-ink">
                  Detail Pesanan
                </h3>
              </div>

              {/* Username Preview Box */}
              <div className="flex items-center gap-3.5 rounded-well border border-line bg-canvas/80 p-3.5">
                {showAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={verifiedAvatar as string}
                    alt={`Avatar ${verifiedName}`}
                    width={44}
                    height={44}
                    className="size-11 shrink-0 rounded-well bg-paper object-cover outline outline-1 -outline-offset-1 outline-line"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-well bg-astra/10 text-[12px] font-black text-astra-ink">
                    RBX
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-extrabold text-ink">
                    {username.trim() ? username : "Username Roblox"}
                  </span>
                  <span className="text-[11px] text-ink-mute">
                    {username.trim() ? "Tujuan pengiriman" : "Belum diisi"}
                  </span>
                </div>
              </div>

              {/* Order Rows */}
              <div className="flex flex-col gap-2.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Layanan:</span>
                  <span className="font-extrabold text-ink">Robux via Username</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Proses Masuk:</span>
                  <span className="rounded-full border border-success/25 bg-success/[0.06] px-2.5 py-0.5 text-[10px] font-extrabold text-success">
                    Langsung Masuk (Tanpa Pending)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Jumlah Robux:</span>
                  <span className="num font-extrabold text-ink">{formatNumber(robux)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Kategori Usia:</span>
                  <span className="font-extrabold text-ink">
                    {ageCategory === "-18" ? "Di bawah 18 tahun" : "18 tahun ke atas"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Metode Bayar:</span>
                  <span className="font-extrabold text-ink">
                    {paymentMethod === "qris"
                      ? "QRIS"
                      : paymentMethod === "va"
                        ? "Virtual Account"
                        : "Saldo Akun"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Biaya Admin:</span>
                  <span className="num font-extrabold text-ink">+{formatIDR(config.adminFee)}</span>
                </div>
              </div>

              {/* Total Payment Box */}
              <div className="rounded-well border border-astra/25 bg-astra/[0.06] p-4 text-center">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">
                  Total Pembayaran
                </div>
                <div className="text-[10px] text-ink-mute">Termasuk biaya admin gateway</div>
                {promoCut ? (
                  <div className="num text-[12px] font-bold text-ink-mute line-through">
                    {formatIDR(totalPrice)}
                  </div>
                ) : null}
                <div className="num mt-1 text-[1.85rem] font-black tracking-tight text-astra-ink">
                  {formatIDR(finalPrice)}
                </div>
                {promoCut ? (
                  <div className="num text-[11px] font-extrabold text-success">
                    Hemat {formatIDR(promoCut)}
                  </div>
                ) : null}
              </div>

              {/* Voucher Input */}
              <PromoField
                subtotal={price}
                onCutChange={setPromoCut}
                onCodeChange={setPromoCode}
              />

              {/* Login Notice Box */}
              {!isLoggedIn ? <LoginRequiredNotice /> : null}

              {payError ? (
                <p className="rounded-control border border-astra/25 bg-astra/[0.06] px-3.5 py-2.5 text-[11px] font-bold text-astra-ink">
                  {payError}
                </p>
              ) : null}

              {/* Security Badge */}
              <div className="flex items-center justify-between rounded-control border border-line/80 bg-paper px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="grid size-4 place-items-center rounded-full bg-success/10 text-white">
                    <IconCheck size={10} />
                  </span>
                  <span className="text-[11px] font-bold text-ink-dim">Berhasil!</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-ink-mute">
                  <IconShieldCheck size={14} className="text-ink-mute" />
                  <span className="font-semibold">Protected</span>
                </div>
              </div>

              {/* Main CTA */}
              <RobuxMainCta
                enabled={isLoggedIn}
                priceLabel={formatIDR(Math.max(0, finalPrice))}
                onPay={handlePay}
                paying={paying}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
