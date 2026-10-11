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
    <div className="shell pb-28 pt-24 md:pt-32">
      <RobuxServiceTabs current="premium" />

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_390px]">
        {/* ─── Left Column ─── */}
        <div className="flex flex-col gap-6">
          {/* ── LANGKAH 1: Durasi ── */}
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_4px_24px_rgba(23,21,46,0.04)] md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="rounded-full bg-ink px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 1
              </span>
              <h2 className="font-display text-lg font-extrabold text-ink md:text-title">
                Pilih Durasi Premium
              </h2>
            </div>

            <div className="mb-6 flex items-center justify-between gap-3 rounded-well border border-info/25 bg-info/[0.06] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-control bg-info/10 text-ink">
                  <IconCrown size={16} />
                </span>
                <span className="text-[12px] font-semibold text-info md:text-[13px]">
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
                      "relative flex flex-col items-center gap-1 rounded-well border-2 p-4 text-center transition-all duration-200",
                      active
                        ? "border-astra bg-astra/[0.06]"
                        : "border-line bg-paper hover:border-line-strong hover:bg-canvas/70",
                    )}
                  >
                    {plan.badge ? (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                        {plan.badge}
                      </span>
                    ) : null}
                    <span
                      className={cx(
                        "text-[14px] font-extrabold",
                        active ? "text-astra" : "text-ink",
                      )}
                    >
                      {plan.label}
                    </span>
                    <span className="num text-[13px] font-bold text-ink-mute">
                      {formatIDR(price)}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-[11px] text-ink-mute">
              Harga di atas dihitung dari rate Premium aktif ({formatIDR(monthly)} / bulan).
            </p>
          </div>

          {/* ── LANGKAH 2: Kredensial ── */}
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_4px_24px_rgba(23,21,46,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-ink px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 2
              </span>
              <h2 className="font-display text-lg font-extrabold text-ink md:text-title">
                Data Akun Roblox
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-ink-mute">
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
                accentClass="focus-within:border-astra focus-within:ring-astra/10"
              />

              <div>
                <label
                  htmlFor="premium-password"
                  className="mb-1.5 block eyebrow text-ink-mute"
                >
                  Kata Sandi Roblox
                </label>
                <div className="flex items-center gap-3 rounded-well border-2 border-line bg-paper px-4 py-3.5 transition-all focus-within:border-astra focus-within:ring-4 focus-within:ring-astra/10">
                  <IconLock size={18} className="shrink-0 text-ink-mute" />
                  <input
                    id="premium-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kata sandi akun Roblox"
                    autoComplete="new-password"
                    className="w-full bg-transparent text-[15px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-mute"
                    aria-label="Kata sandi Roblox"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="shrink-0 text-[11px] font-bold text-ink-mute transition-colors hover:text-ink-dim"
                  >
                    {showPassword ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="premium-2fa"
                  className="mb-1.5 block eyebrow text-ink-mute"
                >
                  Kode Cadangan 2FA <span className="font-bold normal-case tracking-normal text-ink-mute">(opsional)</span>
                </label>
                <div className="flex items-center gap-3 rounded-well border-2 border-line bg-paper px-4 py-3.5 transition-all focus-within:border-astra focus-within:ring-4 focus-within:ring-astra/10">
                  <IconShieldCheck size={18} className="shrink-0 text-ink-mute" />
                  <input
                    id="premium-2fa"
                    type="text"
                    value={twoFactor}
                    onChange={(e) => setTwoFactor(e.target.value)}
                    placeholder="cth: a1b2c3d4, e5f6g7h8"
                    autoComplete="off"
                    className="w-full bg-transparent text-[15px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-mute"
                    aria-label="Kode cadangan 2FA"
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">
                  Kalau akun memakai verifikasi 2 langkah, tempel 1–2 kode cadangan agar penjual
                  bisa masuk. Ambil di Roblox: Pengaturan → Keamanan → Kode cadangan 2SV.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-well border border-warn/25 bg-warn/[0.06] p-4">
              <span className="grid size-6 shrink-0 place-items-center rounded-control bg-warn/10 text-warn">
                <IconAlert size={15} />
              </span>
              <p className="text-[12px] leading-relaxed text-warn">
                Demi keamanan, sebaiknya ganti kata sandi akun setelah langganan selesai diproses.
                Jangan aktifkan fitur yang memblokir login dari perangkat baru saat pesanan berjalan.
              </p>
            </div>
          </div>

          {/* ── LANGKAH 3: Bayar ── */}
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_4px_24px_rgba(23,21,46,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-ink px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 3
              </span>
              <h2 className="font-display text-lg font-extrabold text-ink md:text-title">
                Pilih Cara Bayar
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-ink-mute">
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
                      "flex items-center justify-center gap-2 rounded-well border-2 px-3 py-3.5 text-[12px] font-bold transition-all duration-200",
                      isSelected
                        ? "border-astra bg-paper text-astra"
                        : "border-line bg-paper text-ink-dim hover:border-line-strong",
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
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_6px_28px_rgba(23,21,46,0.06)]">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-ink px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  Ringkasan
                </span>
                <h3 className="font-display text-base font-extrabold text-ink">
                  Detail Pesanan
                </h3>
              </div>

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
                  <span className="grid size-11 shrink-0 place-items-center rounded-well bg-info/10 text-info">
                    <IconCrown size={20} />
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-extrabold text-ink">
                    {username.trim() ? username : "Username Roblox"}
                  </span>
                  <span className="text-[11px] text-ink-mute">
                    {username.trim() ? "Akun yang diaktifkan" : "Belum diisi"}
                  </span>
                </div>
                {twoFactor.trim() ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-info/25 bg-info/[0.06] px-2.5 py-0.5 text-[10px] font-extrabold text-info">
                    <IconShieldCheck size={11} />
                    2FA
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Layanan:</span>
                  <span className="font-extrabold text-ink">Roblox Premium</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Durasi:</span>
                  <span className="font-extrabold text-ink">
                    {PLANS.find((p) => p.months === months)?.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Diproses oleh:</span>
                  <span className="rounded-full border border-info/25 bg-info/[0.06] px-2.5 py-0.5 text-[10px] font-extrabold text-info">
                    Penjual
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
                {paymentMethod === "saldo" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-mute">Saldo kamu:</span>
                    <span className="num font-extrabold text-ink">
                      {formatIDR(walletBalance)}
                      {walletBalance < finalPrice ? " (kurang)" : " (cukup)"}
                    </span>
                  </div>
                ) : null}
              </div>

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
                <div className="num mt-1 text-[1.85rem] font-black tracking-tight text-astra">
                  {formatIDR(Math.max(0, finalPrice))}
                </div>
                {promoCut ? (
                  <div className="num text-[11px] font-extrabold text-success">
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
                <p className="rounded-control border border-astra/25 bg-astra/[0.06] px-3.5 py-2.5 text-[11px] font-bold text-astra-ink">
                  {payError}
                </p>
              ) : null}

              <div className="flex items-center justify-between rounded-control border border-line/80 bg-paper px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="grid size-4 place-items-center rounded-full bg-success/10 text-white">
                    <IconCheck size={10} />
                  </span>
                  <span className="text-[11px] font-bold text-ink-dim">Kredensial terenkripsi</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-ink-mute">
                  <IconShieldCheck size={14} className="text-ink-mute" />
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
