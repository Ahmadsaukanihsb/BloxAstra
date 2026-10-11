"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/cx";
import { formatIDR } from "@/lib/format";
import { premiumSubtotal, PREMIUM_PLANS } from "@/lib/robux-orders";
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
  IconLock,
  IconShieldCheck,
  IconBank,
  IconWallet,
  IconQrCode,
  IconCrown,
} from "@/components/ui/icons";

/* ─── Constants ─── */

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

type PaymentMethod = "qris" | "va" | "saldo";

const PLANS = PREMIUM_PLANS;

export function PremiumOrder({
  isLoggedIn,
  walletBalance = 0,
}: {
  isLoggedIn: boolean;
  walletBalance?: number;
}) {
  const router = useRouter();
  const config = useRobuxOrder("premium");

  const [months, setMonths] = useState<number>(1);
  const [username, setUsername] = useState("");
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifiedAvatar, setVerifiedAvatar] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState("");

  function handleVerified(name: string | null, avatarUrl?: string | null) {
    setVerifiedName(name);
    setVerifiedAvatar(avatarUrl ?? null);
  }

  const showAvatar =
    verifiedName !== null &&
    verifiedAvatar !== null &&
    verifiedName.toLowerCase() === username.trim().toLowerCase();
  const [showPassword, setShowPassword] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qris");
  const [promoCut, setPromoCut] = useState(0);
  const [promoCode, setPromoCode] = useState<string | undefined>(undefined);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const monthly = config.rate;

  const subtotal = useMemo(() => premiumSubtotal(monthly, months), [monthly, months]);

  const totalPrice = useMemo(() => subtotal + config.adminFee, [subtotal, config.adminFee]);
  const finalPrice = totalPrice - promoCut;

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
    if (password.trim().length < 4) {
      setPayError("Kata sandi akun Roblox wajib diisi (minimal 4 karakter).");
      return;
    }
    const codes = twoFactor
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (codes.length > 10 || codes.some((code) => !/^[A-Za-z0-9-]{4,16}$/.test(code))) {
      setPayError("Kode cadangan 2FA tidak valid (4–16 karakter alfanumerik per kode, maks 10).");
      return;
    }
    setPaying(true);
    setPayError(null);
    const result = await createRobuxOrder({
      kind: "premium",
      robuxAmount: months,
      robloxUsername: handle,
      password: password.trim(),
      twoFactorBackupCodes: codes.length ? codes.join(" ") : undefined,
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
      <RobuxServiceTabs current="premium" />

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_390px]">
        {/* ─── Left Column ─── */}
        <div className="flex flex-col gap-6">
          {/* ── LANGKAH 1: Durasi ── */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="rounded-full bg-[#7C3AED] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 1
              </span>
              <h2 className="font-display text-lg font-extrabold text-slate-900 md:text-xl">
                Pilih Durasi Premium
              </h2>
            </div>

            <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-violet-200/90 bg-[#F5F3FF] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-[#7C3AED]">
                  <IconCrown size={16} />
                </span>
                <span className="text-[12px] font-semibold text-[#5B21B6] md:text-[13px]">
                  Premium dibayarkan langsung dari dalam akunmu. Penjual memproses setelah pembayaran masuk.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLANS.map((plan) => {
                const active = months === plan.months;
                const price = premiumSubtotal(monthly, plan.months);
                return (
                  <button
                    key={plan.months}
                    type="button"
                    onClick={() => setMonths(plan.months)}
                    className={cx(
                      "relative flex flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center transition-all duration-200",
                      active
                        ? "border-[#E11D48] bg-rose-50/60 shadow-[0_4px_16px_rgba(225,29,72,0.18)]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
                    )}
                  >
                    {plan.badge ? (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#7C3AED] px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                        {plan.badge}
                      </span>
                    ) : null}
                    <span
                      className={cx(
                        "text-[14px] font-extrabold",
                        active ? "text-[#E11D48]" : "text-slate-900",
                      )}
                    >
                      {plan.label}
                    </span>
                    <span className="num text-[13px] font-bold text-slate-500">
                      {formatIDR(price)}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-[11px] text-slate-400">
              Harga di atas dihitung dari rate Premium aktif ({formatIDR(monthly)} / bulan).
            </p>
          </div>

          {/* ── LANGKAH 2: Kredensial ── */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-[#7C3AED] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 2
              </span>
              <h2 className="font-display text-lg font-extrabold text-slate-900 md:text-xl">
                Data Akun Roblox
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-slate-500">
              Masukkan username dan kata sandi akun Roblox kamu. Kredensial dienkripsi AES-256 dan
              hanya dibuka penjual saat memproses langganan.
            </p>

            <div className="flex flex-col gap-5">
              <UsernameVerifyField
                id="premium-username"
                value={username}
                onChange={setUsername}
                verifiedName={verifiedName}
                onVerified={handleVerified}
                accentClass="focus-within:border-[#7C3AED] focus-within:ring-violet-500/10"
              />

              <div>
                <label
                  htmlFor="premium-password"
                  className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
                >
                  Kata Sandi Roblox
                </label>
                <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 transition-all focus-within:border-[#7C3AED] focus-within:ring-4 focus-within:ring-violet-500/10">
                  <IconLock size={18} className="shrink-0 text-slate-400" />
                  <input
                    id="premium-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kata sandi akun Roblox"
                    autoComplete="new-password"
                    className="w-full bg-transparent text-[15px] font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                    aria-label="Kata sandi Roblox"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="shrink-0 text-[11px] font-bold text-slate-400 transition-colors hover:text-slate-700"
                  >
                    {showPassword ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="premium-2fa"
                  className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
                >
                  Kode Cadangan 2FA <span className="font-bold normal-case tracking-normal text-slate-400">(opsional)</span>
                </label>
                <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 transition-all focus-within:border-[#7C3AED] focus-within:ring-4 focus-within:ring-violet-500/10">
                  <IconShieldCheck size={18} className="shrink-0 text-slate-400" />
                  <input
                    id="premium-2fa"
                    type="text"
                    value={twoFactor}
                    onChange={(e) => setTwoFactor(e.target.value)}
                    placeholder="cth: a1b2c3d4, e5f6g7h8"
                    autoComplete="off"
                    className="w-full bg-transparent text-[15px] font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                    aria-label="Kode cadangan 2FA"
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Kalau akun memakai verifikasi 2 langkah, tempel 1–2 kode cadangan agar penjual
                  bisa masuk. Ambil di Roblox: Pengaturan → Keamanan → Kode cadangan 2SV.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-[#FFFBEB] p-4">
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                <IconAlert size={15} />
              </span>
              <p className="text-[12px] leading-relaxed text-[#92400E]">
                Demi keamanan, sebaiknya ganti kata sandi akun setelah langganan selesai diproses.
                Jangan aktifkan fitur yang memblokir login dari perangkat baru saat pesanan berjalan.
              </p>
            </div>
          </div>

          {/* ── LANGKAH 3: Bayar ── */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-[#7C3AED] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 3
              </span>
              <h2 className="font-display text-lg font-extrabold text-slate-900 md:text-xl">
                Pilih Cara Bayar
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-slate-500">
              Diverifikasi otomatis oleh sistem 24 jam. Penjual mulai memproses setelah pembayaran lunas.
            </p>

            <div className="grid grid-cols-3 gap-2.5">
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
          </div>
        </div>

        {/* ─── Right Column: Summary ─── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_6px_28px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-[#7C3AED] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  Ringkasan
                </span>
                <h3 className="font-display text-base font-extrabold text-slate-900">
                  Detail Pesanan
                </h3>
              </div>

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
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                    <IconCrown size={20} />
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-extrabold text-slate-900">
                    {username.trim() ? username : "Username Roblox"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {username.trim() ? "Akun yang diaktifkan" : "Belum diisi"}
                  </span>
                </div>
                {twoFactor.trim() ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-extrabold text-violet-700">
                    <IconShieldCheck size={11} />
                    2FA
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Layanan:</span>
                  <span className="font-extrabold text-slate-900">Roblox Premium</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Durasi:</span>
                  <span className="font-extrabold text-slate-900">
                    {PLANS.find((p) => p.months === months)?.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Diproses oleh:</span>
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-extrabold text-violet-700">
                    Penjual
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
                {paymentMethod === "saldo" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Saldo kamu:</span>
                    <span className="num font-extrabold text-slate-900">
                      {formatIDR(walletBalance)}
                      {walletBalance < finalPrice ? " (kurang)" : " (cukup)"}
                    </span>
                  </div>
                ) : null}
              </div>

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
                  {formatIDR(Math.max(0, finalPrice))}
                </div>
                {promoCut ? (
                  <div className="num text-[11px] font-extrabold text-emerald-600">
                    Hemat {formatIDR(promoCut)}
                  </div>
                ) : null}
              </div>

              <PromoField
                subtotal={subtotal}
                onCutChange={setPromoCut}
                onCodeChange={setPromoCode}
              />

              {!isLoggedIn ? <LoginRequiredNotice /> : null}

              {payError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] font-bold text-rose-600">
                  {payError}
                </p>
              ) : null}

              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white">
                    <IconCheck size={10} />
                  </span>
                  <span className="text-[11px] font-bold text-slate-700">Kredensial terenkripsi</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <IconShieldCheck size={14} className="text-slate-500" />
                  <span className="font-semibold">Protected</span>
                </div>
              </div>

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
