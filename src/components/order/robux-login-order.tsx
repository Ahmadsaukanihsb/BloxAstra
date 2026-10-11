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
} from "@/components/order/robux-order-shell";
import {
  IconCheck,
  IconEye,
  IconEyeOff,
  IconQrCode,
  IconShieldCheck,
  IconBank,
  IconWallet,
} from "@/components/ui/icons";

/* ─── Constants ─── */

const baseConfig = ROBUX_ORDERS.login;
const MIN_ROBUX = baseConfig.minRobux;
const MAX_ROBUX = baseConfig.maxRobux;

type PaymentMethod = "qris" | "va" | "saldo";

/* ─── Anim variants ─── */
const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

/* ─── Main Component ─── */

export function RobuxLoginOrder({
  isLoggedIn,
  walletBalance = 0,
}: {
  isLoggedIn: boolean;
  walletBalance?: number;
}) {
  const router = useRouter();
  const [robux, setRobux] = useState(1000);
  const [inputValue, setInputValue] = useState("1000");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [parentalPin, setParentalPin] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qris");
  const [promoCut, setPromoCut] = useState(0);
  const [promoCode, setPromoCode] = useState<string | undefined>(undefined);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const config = useRobuxOrder("login");
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
    const identifier = username.trim();
    if (identifier.length < 3) {
      setPayError("Isi username atau email Roblox kamu (min. 3 karakter).");
      return;
    }
    if (password.trim().length < 4) {
      setPayError("Password akun Roblox wajib diisi (min. 4 karakter).");
      return;
    }
    setPaying(true);
    setPayError(null);
    const result = await createRobuxOrder({
      kind: "login",
      robuxAmount: robux,
      robloxUsername: identifier,
      password: password.trim(),
      parentalPin: parentalPin.trim() || undefined,
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
      <RobuxServiceTabs current="login" />

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
                <span className="num rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-[12px] font-bold text-blue-700">
                  Rate: {formatIDR(config.rate * 100)} / 100
                </span>
                <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  Instan
                </span>
              </div>
            </div>

            {/* Info Banner: Via Login */}
            <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-blue-200/90 bg-[#EFF6FF] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full bg-blue-600 ring-4 ring-blue-200" />
                <span className="text-[12px] font-semibold text-[#1E40AF] md:text-[13px]">
                  Via Login: Robux diisikan langsung ke akunmu oleh sistem bot terverifikasi (5-15 menit).
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Proses Kilat
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
                step={20}
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

          {/* ── LANGKAH 2: Data Akun Login ── */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-[#E11D48] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 2
              </span>
              <h2 className="font-display text-lg font-extrabold text-slate-900 md:text-xl">
                Data Akun Roblox
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-slate-500">
              Masukkan kredensial login akun Roblox kamu. Sistem kami menggunakan enkripsi end-to-end terproteksi.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Username Input */}
              <div>
                <label
                  htmlFor="login-username"
                  className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
                >
                  Username / Email Roblox
                </label>
                <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 transition-all focus-within:border-[#E11D48] focus-within:ring-4 focus-within:ring-rose-500/10">
                  <span className="text-base font-bold text-slate-400">@</span>
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username Roblox"
                    className="w-full bg-transparent text-[15px] font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
                >
                  Kata Sandi Roblox
                </label>
                <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 transition-all focus-within:border-[#E11D48] focus-within:ring-4 focus-within:ring-rose-500/10">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent text-[15px] font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              {/* 2FA Backup Code */}
              <div>
                <label
                  htmlFor="login-backup-code"
                  className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
                >
                  Kode Backup 2FA (Jika ada)
                </label>
                <input
                  id="login-backup-code"
                  type="text"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="Contoh: 12345678"
                  className="num w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] font-bold text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-[#E11D48] focus:ring-4 focus:ring-rose-500/10"
                />
              </div>

              {/* Parental PIN */}
              <div>
                <label
                  htmlFor="login-parental-pin"
                  className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
                >
                  PIN Akun Roblox (Jika ada 4 digit)
                </label>
                <input
                  id="login-parental-pin"
                  type="text"
                  maxLength={4}
                  value={parentalPin}
                  onChange={(e) => setParentalPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Contoh: 1234"
                  className="num w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] font-bold text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-[#E11D48] focus:ring-4 focus:ring-rose-500/10"
                />
              </div>
            </div>

            {/* Security Notice Box */}
            <div className="mt-6 rounded-2xl border border-blue-200/80 bg-[#EFF6FF] p-5">
              <div className="mb-2.5 flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
                  <IconShieldCheck size={18} />
                </span>
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[13px] font-extrabold text-[#1E40AF]">
                    Jaminan Keamanan Kredensial 100%
                  </h3>
                  <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                    AES-256
                  </span>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-[#1D4ED8]">
                Password dan data login kamu dienkripsi otomatis di tingkat sistem dan{" "}
                <span className="font-bold underline">langsung dihapus secara permanen</span> setelah
                pengisian Robux selesai. Harap jangan mengubah kata sandi akun Roblox saat proses order sedang berjalan.
              </p>
            </div>

            {/* Optional Notes */}
            <div className="mt-6">
              <label
                htmlFor="admin-notes-login"
                className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
              >
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                id="admin-notes-login"
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
                <span className="grid size-11 place-items-center rounded-2xl bg-blue-100 text-[12px] font-black text-blue-700">
                  RBX
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-extrabold text-slate-900">
                    {username.trim() ? username : "Username Roblox"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {username.trim() ? "Akun pengisian Robux" : "Belum diisi"}
                  </span>
                </div>
              </div>

              {/* Order Rows */}
              <div className="flex flex-col gap-2.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Layanan:</span>
                  <span className="font-extrabold text-slate-900">Robux via Login</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Proses Masuk:</span>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-700">
                    5 - 15 Menit (Kilat)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Jumlah Robux:</span>
                  <span className="num font-extrabold text-slate-900">{formatNumber(robux)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status Enkripsi:</span>
                  <span className="font-extrabold text-emerald-600">Terproteksi SSL</span>
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
