"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cx } from "@/lib/cx";
import { formatIDR, formatNumber } from "@/lib/format";
import { ROBUX_ORDERS, robuxOrderPrice, gamepassQuote, GAMEPASS_TAX_MODE_LABEL, type GamepassTaxMode } from "@/lib/robux-orders";
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
  IconCheck,
  IconGlobe,
  IconQrCode,
  IconShieldCheck,
  IconBank,
  IconWallet,
  IconFileText,
  RobuxGlyph,
} from "@/components/ui/icons";

/* ─── Constants ─── */
const baseConfig = ROBUX_ORDERS.gamepass;
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

export function RobuxGamepassOrder({
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
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifiedAvatar, setVerifiedAvatar] = useState<string | null>(null);
  const [gamepassUrl, setGamepassUrl] = useState("");

  function handleVerified(name: string | null, avatarUrl?: string | null) {
    setVerifiedName(name);
    setVerifiedAvatar(avatarUrl ?? null);
  }

  const showAvatar =
    verifiedName !== null &&
    verifiedAvatar !== null &&
    verifiedName.toLowerCase() === username.trim().toLowerCase();
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qris");
  const [promoCut, setPromoCut] = useState(0);
  const [promoCode, setPromoCode] = useState<string | undefined>(undefined);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const config = useRobuxOrder("gamepass");
  const [taxMode, setTaxMode] = useState<GamepassTaxMode>("cover");

  const quote = useMemo(() => gamepassQuote(taxMode, robux), [taxMode, robux]);
  const quickPacks = useMemo(
    () =>
      config.quickPackRobux.map((amount) => ({
        robux: amount,
        price: robuxOrderPrice(config, amount),
      })),
    [config],
  );

  const requiredGamepassPrice = quote.gamepassPrice;
  const price = robuxOrderPrice(config, quote.billableRobux);
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
    if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)) {
      setPayError("Username Roblox tidak valid (3–20 karakter: huruf, angka, underscore).");
      return;
    }
    if (!verifiedName || verifiedName.toLowerCase() !== handle.toLowerCase()) {
      setPayError("Verifikasi dulu username Roblox dengan tombol Cek.");
      return;
    }
    if (!gamepassUrl.trim()) {
      setPayError("Isi tautan gamepass yang sudah kamu buat di Roblox.");
      return;
    }
    setPaying(true);
    setPayError(null);
    const result = await createRobuxOrder({
      kind: "gamepass",
      robuxAmount: robux,
      taxMode,
      robloxUsername: handle,
      gamepassUrl: gamepassUrl.trim(),
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
      <RobuxServiceTabs current="gamepass" />

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
                  Pilih Nominal Robux Bersih
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="num rounded-full border border-warn/25 bg-warn/[0.06] px-3 py-1 text-[12px] font-bold text-warn">
                  Rate Super Hemat
                </span>
                <span className="rounded-full bg-warn px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  Cover Tax 100%
                </span>
              </div>
            </div>

            {/* Info Banner: Pending 5 Hari */}
            <div className="mb-6 flex items-center justify-between gap-3 rounded-well border border-warn/25 bg-warn/[0.06] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full bg-warn ring-4 ring-warn/25" />
                <span className="text-[12px] font-semibold text-warn md:text-[13px]">
                  Via Gamepass: Robux berstatus Pending 5 hari di akunmu (aturan resmi Roblox) sebelum cair ke saldo aktif.
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-warn px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Pending 5 Hari
              </span>
            </div>

            {/* Tax Mode Toggle */}
            <div className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Mode pajak">
              {(["cover", "no_cover"] as GamepassTaxMode[]).map((mode) => {
                const active = taxMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTaxMode(mode)}
                    className={cx(
                      "flex flex-col items-start gap-1 rounded-well border-2 p-3.5 text-left transition-all duration-200",
                      active
                        ? "border-astra bg-astra/[0.06]"
                        : "border-line bg-paper hover:border-line-strong hover:bg-canvas/70",
                    )}
                  >
                    <span
                      className={cx(
                        "text-[12px] font-extrabold",
                        active ? "text-astra" : "text-ink",
                      )}
                    >
                      {GAMEPASS_TAX_MODE_LABEL[mode]}
                    </span>
                    <span className="text-[11px] leading-relaxed text-ink-mute">
                      {mode === "cover"
                        ? "Kamu pilih Robux bersih, harga gamepass kami naikkan otomatis."
                        : "Kamu tentukan harga gamepass mentah, Robux yang masuk dipotong 30% Roblox."}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Nominal Headline */}
            <div className="mb-1 eyebrow text-ink-mute">
              {taxMode === "cover" ? "Robux Bersih yang Diterima" : "Harga Gamepass yang Kamu Pasang"}
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="num font-display text-[2.75rem] font-extrabold leading-none tracking-tight text-ink">
                {formatNumber(robux)}
              </span>
              <span className="num rounded-full border border-astra/25 bg-astra/[0.06] px-3.5 py-1 text-[14px] font-extrabold text-astra">
                = {formatIDR(price)}
              </span>
            </div>

            {/* Tax Cover Calculation Box */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-well border border-success/25 bg-success/[0.06] p-4 text-success">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-control bg-success/10 text-success">
                  <RobuxGlyph size={20} />
                </span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-success">
                    {taxMode === "cover"
                      ? "Harga Gamepass yang Wajib Dibuat di Roblox:"
                      : "Robux Bersih yang Kamu Terima (setelah pajak 30%):"}
                  </div>
                  <div className="num text-[17px] font-black text-success">
                    {formatNumber(taxMode === "cover" ? requiredGamepassPrice : quote.netRobux)} Robux
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-success px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                {taxMode === "cover" ? "Pajak 30% Kami Tanggung" : "Pajak 30% Kamu Tanggung"}
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
                step={50}
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
                        isSelected ? "text-astra" : "text-ink",
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

          {/* ── LANGKAH 2: Data Gamepass ── */}
          <div className="rounded-card border border-line/80 bg-paper p-6 shadow-[0_4px_24px_rgba(23,21,46,0.04)] md:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="rounded-full bg-astra px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                Langkah 2
              </span>
              <h2 className="font-display text-lg font-extrabold text-ink md:text-title">
                Data Akun & Link Gamepass
              </h2>
            </div>
            <p className="mb-6 text-[12px] text-ink-mute">
              {taxMode === "cover"
                ? `Buat Gamepass di akun Roblox kamu seharga ${formatNumber(requiredGamepassPrice)} Robux lalu masukkan link-nya di bawah.`
                : `Buat Gamepass di akun Roblox kamu seharga ${formatNumber(requiredGamepassPrice)} Robux (Robux bersih ${formatNumber(quote.netRobux)} setelah pajak 30%) lalu masukkan link-nya di bawah.`}
            </p>

            <div className="flex flex-col gap-5">
              {/* Username Input */}
              <UsernameVerifyField
                id="gp-username"
                value={username}
                onChange={setUsername}
                verifiedName={verifiedName}
                onVerified={handleVerified}
              />

              {/* Gamepass Link Input */}
              <div>
                <label
                  htmlFor="gp-url"
                  className="mb-1.5 block eyebrow text-ink-mute"
                >
                  Tautan / Link Gamepass Roblox
                </label>
                <div className="flex items-center gap-3 rounded-well border-2 border-line bg-paper px-4 py-3.5 transition-all focus-within:border-astra focus-within:ring-4 focus-within:ring-astra/10">
                  <IconGlobe size={18} className="text-ink-mute" />
                  <input
                    id="gp-url"
                    type="url"
                    value={gamepassUrl}
                    onChange={(e) => setGamepassUrl(e.target.value)}
                    placeholder="https://www.roblox.com/game-pass/12345678/..."
                    className="w-full bg-transparent text-[14px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-mute"
                  />
                </div>
              </div>
            </div>

            {/* Tutorial Box */}
            <div className="mt-6 rounded-well border border-line/90 bg-canvas/70 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-control bg-astra/10 text-astra">
                  <IconFileText size={15} />
                </span>
                <h3 className="text-[13px] font-extrabold text-ink">
                  Panduan Singkat Membuat Gamepass di Roblox:
                </h3>
              </div>
              <ol className="list-inside list-decimal space-y-2 text-[12px] leading-relaxed text-ink-dim">
                <li>Buka situs <span className="font-bold text-ink">create.roblox.com</span> lalu masuk ke menu <span className="font-bold text-ink">Creations</span>.</li>
                <li>Pilih salah satu Experience/Game publik milikmu, lalu klik menu <span className="font-bold text-ink">Passes</span> di bilah samping.</li>
                <li>Klik tombol <span className="font-bold text-ink">Create a Pass</span>, beri nama bebas, lalu simpan.</li>
                <li>Buka Pass tersebut, pilih menu <span className="font-bold text-ink">Sales</span>, aktifkan opsi <span className="font-bold text-ink">Item for Sale</span> dan masukkan harga persis <span className="font-extrabold text-astra">{formatNumber(requiredGamepassPrice)} Robux</span>.</li>
                <li>Salin link gamepass tersebut dan tempelkan pada kolom di atas.</li>
              </ol>
            </div>

            {/* Optional Notes */}
            <div className="mt-6">
              <label
                htmlFor="admin-notes-gp"
                className="mb-1.5 block eyebrow text-ink-mute"
              >
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                id="admin-notes-gp"
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

            {/* Selected Method Details */}
            <AnimatePresence mode="wait">
              {paymentMethod === "qris" ? (
                <motion.div
                  key="qris"
                  {...fadeSlide}
                  className="rounded-well border border-success/25 bg-success/[0.06] p-4 text-success"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success text-white">
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
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-info text-white">
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
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-info text-white">
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
                  <span className="grid size-11 shrink-0 place-items-center rounded-well bg-warn/10 text-[12px] font-black text-warn">
                    RBX
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-extrabold text-ink">
                    {username.trim() ? username : "Username Roblox"}
                  </span>
                  <span className="text-[11px] text-ink-mute">
                    {username.trim() ? "Penerima Robux" : "Belum diisi"}
                  </span>
                </div>
              </div>

              {/* Order Rows */}
              <div className="flex flex-col gap-2.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Layanan:</span>
                  <span className="font-extrabold text-ink">Robux via Gamepass</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Proses Masuk:</span>
                  <span className="rounded-full border border-warn/25 bg-warn/[0.06] px-2.5 py-0.5 text-[10px] font-extrabold text-warn">
                    Pending 5 Hari (Resmi Roblox)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Mode Pajak:</span>
                  <span className="font-extrabold text-ink">
                    {taxMode === "cover" ? "Ditanggung Blox Astra" : "Ditanggung Pembeli"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Robux Bersih Diterima:</span>
                  <span className="num font-extrabold text-ink">{formatNumber(quote.netRobux)} Robux</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-mute">Harga Gamepass:</span>
                  <span className="num font-extrabold text-success">{formatNumber(requiredGamepassPrice)} Robux</span>
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
                <div className="num mt-1 text-[1.85rem] font-black tracking-tight text-astra">
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
