"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cx } from "@/lib/cx";
import { formatIDR, formatNumber } from "@/lib/format";
import { ROBUX_ORDERS, robuxOrderPrice } from "@/lib/robux-orders";
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
}: {
  isLoggedIn: boolean;
  walletBalance?: number;
}) {
  const router = useRouter();
  const [robux, setRobux] = useState(500);
  const [inputValue, setInputValue] = useState("500");
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
    <div className="mx-auto max-w-[1200px] px-4 pb-28 pt-24 md:px-8 md:pt-32">
      <RobuxServiceTabs current="username" />

      {/* ─── Main Content Grid ─── */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_390px]">
        {/* ─── Left Column: Wizard Steps ─── */}
        <div className="flex flex-col gap-6">
          {/* ── LANGKAH 1: Pilih Nominal ── */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#E11D48] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                  Langkah 1
                </span>
                <h2 className="font-display text-lg font-extrabold text-slate-900 md:text-xl">
                  Pilih Nominal Robux
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="num rounded-full border border-rose-100 bg-rose-50/70 px-3 py-1 text-[12px] font-bold text-rose-700">
                  Rate: {formatIDR(config.rate * 100)} / 100
                </span>
              </div>
            </div>

            {/* Info Banner: Langsung Masuk */}
            <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/90 bg-[#ECFDF5] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full bg-[#10B981] ring-4 ring-emerald-200" />
                <span className="text-[12px] font-semibold text-[#065F46] md:text-[13px]">
                  Via Username: Robux langsung masuk ke akun kamu tanpa pending.
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-[#10B981] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langsung Masuk
              </span>
            </div>

            {/* Nominal Headline */}
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Nominal Robux
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="num font-display text-[2.75rem] font-extrabold leading-none tracking-tight text-slate-900">
                {formatNumber(robux)}
              </span>
              <span className="num rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1 text-[14px] font-extrabold text-[#E11D48]">
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
                className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-base font-bold text-slate-700 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95"
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
                className="num h-11 w-28 rounded-xl border-2 border-slate-200 bg-white px-3 text-center text-base font-extrabold text-slate-900 outline-none transition-all focus:border-[#E11D48] focus:ring-4 focus:ring-rose-500/10"
                aria-label="Input nominal Robux"
              />
              <button
                type="button"
                onClick={() => {
                  const newVal = Math.min(MAX_ROBUX, robux + 100);
                  setRobux(newVal);
                  setInputValue(String(newVal));
                }}
                className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-base font-bold text-slate-700 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95"
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
                  background: `linear-gradient(to right, #E11D48 0%, #F43F5E ${sliderPercent}%, #E2E8F0 ${sliderPercent}%, #E2E8F0 100%)`,
                }}
                aria-label="Slider nominal Robux"
              />
            </div>
            <div className="mb-7 flex justify-between text-[11px] font-bold text-slate-400">
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
                      "flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 p-3 text-center transition-all duration-200",
                      isSelected
                        ? "border-[#E11D48] bg-rose-50/60 shadow-[0_4px_16px_rgba(225,29,72,0.18)] ring-2 ring-[#E11D48]/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
                    )}
                  >
                    <span
                      className={cx(
                        "num text-[17px] font-extrabold",
                        isSelected ? "text-[#E11D48]" : "text-slate-900",
                      )}
                    >
                      {formatNumber(pack.robux)}
                    </span>
                    <span
                      className={cx(
                        "num text-[11px] font-bold",
                        isSelected ? "text-rose-600" : "text-slate-400",
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
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-[#E11D48] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 2
              </span>
              <h2 className="font-display text-lg font-extrabold text-slate-900 md:text-xl">
                Data Akun
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-slate-500">
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
              <p className="mt-1.5 text-[11px] text-slate-400">
                Gunakan username Roblox kamu (bukan display name).
              </p>
            </div>

            {/* ── 2-Step Verification (2SV) Warning Box ── */}
            <div className="rounded-2xl border border-amber-300/80 bg-[#FFFBEB] p-5 shadow-xs">
              <div className="mb-3 flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                  <IconAlert size={18} />
                </span>
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[13px] font-extrabold text-[#92400E]">
                    Akun Roblox Penerima Wajib Menyalakan 2-Step Verification
                  </h3>
                  <span className="rounded bg-[#F59E0B] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                    Wajib
                  </span>
                </div>
              </div>

              <p className="mb-4 text-[12px] leading-relaxed text-[#78350F]">
                Tanpa Verifikasi 2 Langkah, sistem Roblox hanya mengizinkan 500 Robux masuk per hari dan 1.000 per bulan.
                Dengan 2SV aktif (Email Secure), limit akun kamu melonjak jadi 5.000 Robux per hari dan 10.000 per 30 hari
                (per bulan) sehingga Robux dapat langsung terkirim tanpa tertahan.
              </p>

              <div className="mb-4 rounded-xl border border-amber-200/80 bg-[#FEF3C7]/60 p-4">
                <p className="mb-1.5 text-[11px] font-extrabold text-[#92400E]">
                  Panduan Mengaktifkan (Cukup 1 kali saja seumur akun):
                </p>
                <p className="font-mono text-[12px] leading-relaxed text-[#92400E]">
                  Pengaturan (Settings) → Keamanan (Security) → Verifikasi 2 Langkah →{" "}
                  <span className="font-bold text-blue-700 underline underline-offset-2">
                    Pilih Email (Secure)
                  </span>
                </p>
              </div>

              <p className="mb-3.5 text-[11px] text-[#B45309]">
                *Pengaturan awal Roblox adalah None (belum aktif). Klik tombol di bawah untuk langsung menuju halaman pengaturan keamanan Roblox:
              </p>

              <a
                href="https://www.roblox.com/my/account#!/security"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#D97706] px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-[transform,translate,scale,rotate,background-color] hover:bg-[#B45309] active:scale-[0.98]"
              >
                Buka Pengaturan Keamanan Roblox
                <IconGlobe size={14} />
              </a>
            </div>

            {/* Age Category Selector */}
            <div className="mt-6">
              <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
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
                        "rounded-2xl border-2 py-3.5 text-center text-[13px] font-bold transition-all duration-200",
                        isSelected
                          ? "border-[#E11D48] bg-rose-50/60 text-[#E11D48] shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {age === "-18" ? "−18 (di bawah 18)" : "+18 (18 ke atas)"}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Robux langsung terkirim tanpa perlu persetujuan email orang tua.
              </p>
            </div>

            {/* Optional Notes */}
            <div className="mt-6">
              <label
                htmlFor="admin-notes"
                className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
              >
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                id="admin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan khusus untuk admin..."
                rows={2}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white p-3.5 text-[13px] font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#E11D48] focus:ring-4 focus:ring-rose-500/10"
              />
            </div>
          </div>

          {/* ── LANGKAH 3: Pilih Cara Bayar ── */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-[#E11D48] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 3
              </span>
              <h2 className="font-display text-lg font-extrabold text-slate-900 md:text-xl">
                Pilih Cara Bayar
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-slate-500">
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
                      "flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3.5 text-[12px] font-bold transition-all duration-200",
                      isSelected
                        ? "border-[#E11D48] bg-white text-[#E11D48] shadow-[0_4px_14px_rgba(225,29,72,0.14)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
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
                  className="rounded-2xl border border-emerald-200/90 bg-[#F0FDF4] p-4 text-[#166534]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                      <IconCheck size={12} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-extrabold">
                        QRIS (Semua Bank & E-Wallet)
                      </span>
                      <p className="text-[12px] leading-relaxed text-[#15803D]">
                        Dapat dibayar melalui <span className="font-bold">GoPay, OVO, DANA, ShopeePay, LinkAja, BCA Mobile, Livin Mandiri, BRImo, BNI Mobile</span>, dan semua aplikasi perbankan yang mendukung QRIS.
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : paymentMethod === "va" ? (
                <motion.div
                  key="va"
                  {...fadeSlide}
                  className="rounded-2xl border border-blue-200/90 bg-[#EFF6FF] p-4 text-[#1E40AF]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-blue-600 text-white">
                      <IconCheck size={12} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-extrabold">
                        Virtual Account
                      </span>
                      <p className="text-[12px] leading-relaxed text-[#1D4ED8]">
                        Transfer melalui nomor VA otomatis ke <span className="font-bold">BCA, BNI, BRI, Mandiri, Permata, CIMB</span>. Verifikasi instan 24 jam.
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="saldo"
                  {...fadeSlide}
                  className="rounded-2xl border border-violet-200/90 bg-[#F5F3FF] p-4 text-[#5B21B6]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-violet-600 text-white">
                      <IconCheck size={12} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-extrabold">
                        Saldo Akun Blox Astra
                      </span>
                      <p className="text-[12px] leading-relaxed text-[#6D28D9]">
                        Potong langsung dari saldo dompet Blox Astra kamu tanpa biaya gateway tambahan.
                      </p>
                      <p className="num text-[12px] font-extrabold text-[#5B21B6]">
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
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_6px_28px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-5">
              {/* Summary Header */}
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-[#E11D48] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  Ringkasan
                </span>
                <h3 className="font-display text-base font-extrabold text-slate-900">
                  Detail Pesanan
                </h3>
              </div>

              {/* Username Preview Box */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                {showAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={verifiedAvatar as string}
                    alt={`Avatar ${verifiedName}`}
                    width={44}
                    height={44}
                    className="size-11 shrink-0 rounded-2xl bg-white object-cover outline outline-1 -outline-offset-1 outline-slate-200"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-[12px] font-black text-[#E11D48]">
                    RBX
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-extrabold text-slate-900">
                    {username.trim() ? username : "Username Roblox"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {username.trim() ? "Tujuan pengiriman" : "Belum diisi"}
                  </span>
                </div>
              </div>

              {/* Order Rows */}
              <div className="flex flex-col gap-2.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Layanan:</span>
                  <span className="font-extrabold text-slate-900">Robux via Username</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Proses Masuk:</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                    Langsung Masuk (Tanpa Pending)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Jumlah Robux:</span>
                  <span className="num font-extrabold text-slate-900">{formatNumber(robux)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Kategori Usia:</span>
                  <span className="font-extrabold text-slate-900">
                    {ageCategory === "-18" ? "Di bawah 18 tahun" : "18 tahun ke atas"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Metode Bayar:</span>
                  <span className="font-extrabold text-slate-900">
                    {paymentMethod === "qris"
                      ? "QRIS"
                      : paymentMethod === "va"
                        ? "Virtual Account"
                        : "Saldo Akun"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Biaya Admin:</span>
                  <span className="num font-extrabold text-slate-900">+{formatIDR(config.adminFee)}</span>
                </div>
              </div>

              {/* Total Payment Box */}
              <div className="rounded-2xl border border-rose-200/80 bg-[#FFF1F2] p-4 text-center">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Total Pembayaran
                </div>
                <div className="text-[10px] text-slate-400">Termasuk biaya admin gateway</div>
                {promoCut ? (
                  <div className="num text-[12px] font-bold text-slate-400 line-through">
                    {formatIDR(totalPrice)}
                  </div>
                ) : null}
                <div className="num mt-1 text-[1.85rem] font-black tracking-tight text-[#E11D48]">
                  {formatIDR(finalPrice)}
                </div>
                {promoCut ? (
                  <div className="num text-[11px] font-extrabold text-emerald-600">
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
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] font-bold text-rose-600">
                  {payError}
                </p>
              ) : null}

              {/* Security Badge */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white">
                    <IconCheck size={10} />
                  </span>
                  <span className="text-[11px] font-bold text-slate-700">Berhasil!</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <IconShieldCheck size={14} className="text-slate-500" />
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
