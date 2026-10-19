"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatIDR, formatNumber } from "@/lib/format";
import { listingQuote } from "@/lib/robux-pricing";
import { useRateCard } from "@/components/rates/rate-store";
import type { Category, Product, Seller } from "@/lib/types";
import { createCatalogOrder, validatePromoAction } from "@/app/actions/orders";
import { verifyRobloxUsername } from "@/app/actions/roblox";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, OptionCard, TextInput } from "@/components/ui/field";
import { Notice, ProgressBar } from "@/components/ui/feedback";
import { ProductArt, SellerAvatar } from "@/components/ui/art";
import { Countdown } from "@/components/order/runtime";
import {
  IconAlert,
  IconArrowRight,
  IconBank,
  IconBolt,
  IconCheck,
  IconClock,
  IconGlobe,
  IconInfo,
  IconLock,
  IconPhone,
  IconQrCode,
  IconShieldCheck,
  IconWallet,
} from "@/components/ui/icons";

const STEPS = ["Akun Roblox", "Pembayaran", "Tinjau & bayar"];

type PaymentFeeMap = Record<"qris" | "va" | "ewallet" | "saldo", number>;

const PAYMENTS = [
  {
    id: "qris",
    title: "QRIS (semua bank & e-wallet)",
    description: "Scan sekali, konfirmasi otomatis lewat webhook payment gateway.",
    icon: IconQrCode,
  },
  {
    id: "va",
    title: "Virtual Account BCA / BNI / Mandiri",
    description: "Nomor VA unik dibuat per pesanan, dana masuk rata-rata di bawah 1 menit.",
    icon: IconBank,
  },
  {
    id: "ewallet",
    title: "GoPay / OVO / DANA",
    description: "Terhubung ke saldo e-wallet, cocok untuk transaksi di bawah Rp500.000.",
    icon: IconPhone,
  },
  {
    id: "saldo",
    title: "Saldo Akun Blox Astra",
    description: "Potong langsung dari dompetmu, tanpa biaya gateway. Pesanan langsung lunas.",
    icon: IconWallet,
  },
];

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

interface CheckoutFlowProps {
  product: Product;
  seller: Seller;
  category: Category;
  isLoggedIn: boolean;
  initialMode: "cover" | "no_cover";
  initialQuantity: number;
  paymentFees: PaymentFeeMap;
  walletBalance?: number;
}

export function CheckoutFlow({
  product,
  seller,
  category,
  isLoggedIn,
  initialMode,
  initialQuantity,
  paymentFees,
  walletBalance = 0,
}: CheckoutFlowProps) {
  const rateCard = useRateCard();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState<{ name: string } | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [avatarOwned, setAvatarOwned] = useState(false);
  const [payment, setPayment] = useState("qris");
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoCut, setPromoCut] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [agree, setAgree] = useState(false);
  const [mode, setMode] = useState<"cover" | "no_cover">(initialMode);
  const [quantity] = useState(initialQuantity);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const isGamepass = product.category === "gamepass";
  const netRobux = product.netRobux ?? 0;
  const quantityLabel = quantity > 1 ? ` (${quantity} ×)` : "";
  const subtotal = isGamepass
    ? listingQuote(netRobux, mode, quantity, rateCard).totalIdr
    : product.price * quantity;
  const coverQuote = listingQuote(netRobux, "cover", 1, rateCard);
  const noCoverQuote = listingQuote(netRobux, "no_cover", 1, rateCard);
  const platformFee = Math.round((subtotal * category.commissionPercent) / 100);
  const method = PAYMENTS.find((item) => item.id === payment) ?? PAYMENTS[0];
  const methodFee = paymentFees[method.id as keyof PaymentFeeMap] ?? 0;
  const total = Math.max(1000, subtotal + platformFee + methodFee - promoCut);

  function verifyUsername() {
    setUsernameError(null);
    if (!USERNAME_PATTERN.test(username)) {
      setVerified(null);
      setUsernameError(
        "Username Roblox hanya boleh huruf, angka, dan garis bawah, panjang 3–20 karakter.",
      );
      return;
    }
  setChecking(true);
  void (async () => {
      const result = await verifyRobloxUsername(username.trim());
      if (result.ok && result.found) {
        setVerified({ name: result.canonicalName ?? username });
        setUsernameError(null);
      } else if (result.ok) {
        setVerified(null);
        setUsernameError(`Username @${username} tidak ditemukan di Roblox.`);
      } else {
        setVerified(null);
        setUsernameError(`${result.error} Tekan "Cek username" untuk mengulang.`);
      }
      setChecking(false);
    })();
  }

  async function applyPromo() {
    const code = promo.trim().toUpperCase();
    setPromoError(null);
    if (!code) {
      setPromoApplied(false);
      setPromoCut(0);
      return;
    }
    setCheckingPromo(true);
    try {
      const result = await validatePromoAction(code, subtotal);
      if (result.ok) {
        setPromoApplied(true);
        setPromoCut(result.cut);
      } else {
        setPromoApplied(false);
        setPromoCut(0);
        setPromoError(result.error);
      }
    } finally {
      setCheckingPromo(false);
    }
  }

  async function handlePay() {
    if (!isLoggedIn) {
      router.push("/masuk");
      return;
    }
    setPaying(true);
    setPayError(null);
    const result = await createCatalogOrder({
      productSlug: product.slug,
      mode,
      quantity,
      robloxUsername: username,
      paymentMethod: payment as "qris" | "va" | "ewallet" | "saldo",
      promoCode: promoApplied ? promo.trim().toUpperCase() : undefined,
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

  const stepOneReady = Boolean(verified) && avatarOwned;

  const stepTwoReady = Boolean(payment);

  return (
    <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-4 pb-24 pt-28 md:px-8 md:pt-36 lg:grid-cols-[1fr_400px] lg:items-start">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
 <h1 className="font-display text-page font-extrabold text-ink md:text-page">
            Checkout aman
          </h1>
          <p className="max-w-[60ch] text-[13px] leading-relaxed text-ink-dim">
            Tiga langkah, dan dana kamu langsung ditahan di rekening penampungan platform, bukan di
            saldo penjual.
          </p>
        </div>

        <ol className="grid grid-cols-3 gap-2.5">
          {STEPS.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li
                key={label}
                className={cx(
                  "flex flex-col gap-2 rounded-well p-3.5 outline outline-1 -outline-offset-1 transition-colors duration-500",
                  active
                    ? "bg-astra/[0.06] outline-astra/30"
                    : "bg-canvas outline-line",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cx(
                      "num grid size-5 place-items-center rounded-full text-[10px]",
                      done || active ? "bg-astra text-white" : "bg-canvas text-ink-mute",
                    )}
                  >
                    {done ? <IconCheck size={11} /> : index + 1}
                  </span>
                  <span
                    className={cx(
                      "text-[11px] font-bold",
                      active ? "text-ink" : done ? "text-ink-dim" : "text-ink-mute",
                    )}
                  >
                    {label}
                  </span>
                </span>
                <ProgressBar value={done ? 1 : active ? 0.5 : 0} tone={active ? "astra" : "robux"} />
              </li>
            );
          })}
        </ol>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="bezel-shell p-1.5"
          >
            <div className="bezel-core flex flex-col gap-6 p-6">
              {step === 0 ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
 <h2 className="text-base font-bold text-ink">Akun Roblox tujuan</h2>
                      <p className="text-[12px] text-ink-mute">
                        Pastikan username Roblox tujuan sudah benar sebelum lanjut.
                      </p>
                    </div>
                  </div>

                  <Field
                    label="Username Roblox"
                    htmlFor="roblox-username"
                    error={usernameError}
                    hint="Pastikan huruf besar-kecil sesuai. Salah username berarti barang dikirim ke orang lain."
                  >
                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <TextInput
                        id="roblox-username"
                        value={username}
                        invalid={Boolean(usernameError)}
                        onChange={(event) => {
                          setUsername(event.target.value);
                          setVerified(null);
                        }}
                        placeholder="mis. rangga_pradipta"
                        autoComplete="off"
                      />
                      <Button
                        variant="secondary"
                        onClick={verifyUsername}
                        disabled={checking || username.length < 3}
                        className="shrink-0"
                        leadingIcon={
                          checking ? (
                            <span className="size-3.5 animate-[orbit_0.9s_linear_infinite] rounded-full border-2 border-ink-mute/30 border-t-ink-mute" />
                          ) : (
                            <IconGlobe size={15} />
                          )
                        }
                      >
                        {checking ? "Memeriksa" : "Cek username"}
                      </Button>
                    </div>
                  </Field>

                  {verified ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center gap-4 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-astra/25"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
                          <span className="num">@{verified.name}</span>
                          <Badge tone="astra" icon={<IconCheck size={11} />}>
                            Akun Roblox terverifikasi
                          </Badge>
                        </span>
                        <span className="text-[11px] text-ink-mute">
                          Nama ini dicek langsung ke server Roblox. Cek ulang sebelum bayar; barang
                          dikirim ke username ini.
                        </span>
                      </div>
                    </motion.div>
                  ) : null}

                  <Checkbox
                    id="avatar-owned"
                    checked={avatarOwned}
                    onChange={setAvatarOwned}
                    label="Saya menyatakan bahwa profil avatar ini benar milik saya"
                    description="Pernyataan palsu membuat pesanan dibatalkan tanpa refund komisi."
                  />
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <div className="flex flex-col gap-1">
 <h2 className="text-base font-bold text-ink">Metode pembayaran</h2>
                    <p className="text-[12px] text-ink-mute">
                      Semua dana masuk ke rekening penampungan platform, bukan ke rekening
                      penjual.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Metode pembayaran">
                    {PAYMENTS.map((option) => (
                      <OptionCard
                        key={option.id}
                        selected={payment === option.id}
                        onSelect={() => setPayment(option.id)}
                        title={option.title}
                        description={option.description}
                        icon={<option.icon size={17} />}
                        meta={
                          paymentFees[option.id as keyof PaymentFeeMap]
                            ? `+${formatIDR(paymentFees[option.id as keyof PaymentFeeMap])}`
                            : "tanpa biaya"
                        }
                      />
                    ))}
                  </div>

                  {payment === "saldo" ? (
                    <Notice
                      tone={walletBalance >= total ? "astra" : "warn"}
                      icon={<IconWallet size={15} />}
                      title={`Saldo kamu ${formatIDR(walletBalance)}`}
                    >
                      {walletBalance >= total
                        ? "Cukup untuk pesanan ini. Dana langsung ditahan platform tanpa menunggu gateway."
                        : "Belum cukup untuk total ini. Pilih metode lain, atau selesaikan setelah refund masuk."}
                    </Notice>
                  ) : null}

                  {isGamepass ? (
                    <div className="flex flex-col gap-3 border-t border-line pt-5">
                      <span className="eyebrow text-ink-mute">
                        Instruksi gamepass
                      </span>
                      <OptionCard
                        selected={mode === "cover"}
                        onSelect={() => setMode("cover")}
                        title={`Cover Tax: pasang ${formatNumber(coverQuote.gamepassPrice)} Robux`}
                        description={`Bayar ${formatIDR(
                          coverQuote.totalIdr,
                        )} untuk menerima ${formatNumber(coverQuote.netRobux)} Robux bersih.`}
                      />
                      <OptionCard
                        selected={mode === "no_cover"}
                        onSelect={() => setMode("no_cover")}
                        title={`No Cover Tax: pasang ${formatNumber(
                          noCoverQuote.gamepassPrice,
                        )} Robux`}
                        description={`Pajak 30% dipotong dari sisimu: terima ${formatNumber(
                          noCoverQuote.netRobux,
                        )} Robux.`}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2.5 border-t border-line pt-5 sm:flex-row sm:items-end">
                    <Field
                      label="Kode promo"
                      htmlFor="promo"
                      className="flex-1"
                      error={promoError ?? undefined}
                      hint={promoApplied ? "Kode promo berhasil dipakai." : undefined}
                    >
                      <TextInput
                        id="promo"
                        value={promo}
                        onChange={(event) => {
                          const next = event.target.value.toUpperCase();
                          setPromo(next);
                          setPromoError(null);
                          if (promoApplied && next.trim().toUpperCase() !== promo.trim().toUpperCase()) {
                            setPromoApplied(false);
                            setPromoCut(0);
                          }
                        }}
                        placeholder="mis. HEMAT5RB"
                      />
                    </Field>
                    <Button
                      variant="secondary"
                      onClick={applyPromo}
                      disabled={checkingPromo}
                      className="sm:mb-0"
                    >
                      {checkingPromo ? "Memeriksa…" : promoApplied ? "Terpakai" : "Pakai kode"}
                    </Button>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="flex flex-col gap-1">
 <h2 className="text-base font-bold text-ink">Tinjau pesanan</h2>
                    <p className="text-[12px] text-ink-mute">
                      Periksa sekali lagi. Setelah dibayar, dana terkunci di rekening penampungan
                      platform sampai barang kamu terima.
                    </p>
                  </div>

                  {!isLoggedIn ? (
                    <Notice tone="warn" icon={<IconLock size={15} />} title="Belum login">
                      Masuk dulu dengan akun Blox Astra kamu sebelum menyelesaikan pembayaran.
                    </Notice>
                  ) : null}

                  <div className="flex flex-col gap-2.5 rounded-well bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
                    {[
                      { label: "Produk", value: product.title },
                      { label: "Penjual", value: `${seller.storeName} · Tier ${seller.tier}` },
                      { label: "Akun tujuan", value: `@${username || "belum diisi"}` },
                      { label: "Metode bayar", value: method.title },
                      {
                        label: "Mode pajak",
                        value: isGamepass
                          ? mode === "cover"
                            ? `Cover tax · gamepass ${formatNumber(
                                listingQuote(netRobux, "cover", 1, rateCard).gamepassPrice,
                              )} Robux`
                            : `No cover tax · gamepass ${formatNumber(
                                noCoverQuote.gamepassPrice,
                              )} Robux`
                          : "tidak berlaku",
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-start justify-between gap-6 border-b border-line pb-2.5 last:border-b-0 last:pb-0"
                      >
                        <span className="text-[11px] text-ink-mute">{row.label}</span>
                        <span className="text-right text-[12px] text-ink">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-mute">
                    Total final mengikuti rate card yang aktif saat kamu menekan bayar. Angka di
                    atas dihitung ulang server sebelum tagihan dibuat.
                  </p>

                  {payment === "saldo" ? (
                    <Notice tone="astra" icon={<IconWallet size={15} />} title="Bayar instan tanpa kedaluwarsa">
                      Saldo langsung dipotong dan pesanan berstatus lunas begitu kamu menekan tombol
                      bayar. Tidak ada tagihan 15 menit.
                    </Notice>
                  ) : (
                    <Notice tone="warn" icon={<IconClock size={15} />} title="Tagihan kedaluwarsa 15 menit">
                      Setelah menekan bayar, kamu punya 15 menit untuk menyelesaikan pembayaran.
                      Lewat dari itu pesanan dibatalkan otomatis dan dana tidak pernah ditahan.
                    </Notice>
                  )}

                  <Checkbox
                    id="agree"
                    checked={agree}
                    onChange={setAgree}
                    label="Saya setuju dengan aturan penahanan dana dan kebijakan sengketa Blox Astra"
                    description="Termasuk ketentuan bahwa barang tidak boleh ditukar setelah dana dilepas ke penjual."
                  />

                  {payError ? (
                    <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal membuat pesanan">
                      {payError}
                    </Notice>
                  ) : null}
                </>
              ) : null}

              <div className="flex flex-col gap-2.5 border-t border-line pt-5 sm:flex-row sm:justify-between">
                {step > 0 ? (
                  <Button
                    variant="ghost"
                    disabled={paying}
                    onClick={() => setStep((value) => value - 1)}
                  >
                    Kembali
                  </Button>
                ) : (
                  <ButtonLink href={`/produk/${product.slug}`} variant="ghost">
                    Lihat detail produk
                  </ButtonLink>
                )}

                {step < 2 ? (
                  <Button
                    size="lg"
                    disabled={step === 0 ? !stepOneReady : !stepTwoReady}
                    onClick={() => setStep((value) => value + 1)}
                    trailingIcon={<IconArrowRight size={16} />}
                    iconCircleClassName="bg-paper/20"
                  >
                    {step === 0 ? "Lanjut ke pembayaran" : "Lanjut ke tinjauan"}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    disabled={!agree || paying || expired}
                    onClick={handlePay}
                    trailingIcon={
                      paying ? (
                        <span className="size-3.5 animate-[orbit_0.9s_linear_infinite] rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <IconLock size={15} />
                      )
                    }
                    iconCircleClassName="bg-paper/20"
                  >
                    {!isLoggedIn
                      ? "Login untuk bayar"
                      : expired
                        ? "Tagihan kedaluwarsa, muat ulang"
                        : paying
                          ? payment === "saldo"
                            ? "Memotong saldo…"
                            : "Mengarahkan ke pembayaran…"
                          : `Bayar ${formatIDR(total)}`}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-28">
        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-4 p-5">
            <span className="eyebrow text-ink-mute">
              Ringkasan pesanan
            </span>

            <div className="flex items-center gap-3.5">
              <ProductArt
                seed={product.slug}
                category={product.category}
                className="size-16 shrink-0 rounded-well outline outline-1 -outline-offset-1 outline-line-strong"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[13px] font-bold leading-snug text-ink">
                  {product.title}
                </span>
                <span className="text-[11px] text-ink-mute">{category.name}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-line pt-4">
              <SummaryRow label={`Subtotal${quantityLabel}`} value={formatIDR(subtotal)} />
              <SummaryRow
                label={`Komisi platform ${category.commissionPercent.toFixed(1).replace(".", ",")}%`}
                value={formatIDR(platformFee)}
              />
              <SummaryRow
                label="Biaya metode bayar"
                value={methodFee ? formatIDR(methodFee) : "gratis"}
              />
              {promoCut ? (
                <SummaryRow label="Promo" value={`−${formatIDR(promoCut)}`} tone="astra" />
              ) : null}
            </div>

            <div className="flex items-end justify-between border-t border-line pt-4">
              <span className="text-[11px] uppercase tracking-[0.16em] text-ink-mute">
                Total ditahan
              </span>
              <span className="num text-xl font-extrabold text-astra-ink">{formatIDR(total)}</span>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-line pt-4">
              <div className="flex items-center gap-2.5">
                <SellerAvatar
                  name={seller.storeName}
                  size={30}
                  online={seller.isOnline}
                  imageUrl={seller.storeImage}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12px] text-ink">{seller.storeName}</span>
                  <span className="text-[10px] text-ink-mute">
                    {seller.isOnline ? "online · siap kirim" : "istirahat"}
                  </span>
                </div>
                {seller.hasExpressBadge ? (
                  <Badge tone="astra" icon={<IconBolt size={11} />}>
                    kilat
                  </Badge>
                ) : null}
              </div>
              {payment === "saldo" ? null : (
                <Timer expirySeconds={15 * 60} onExpire={() => setExpired(true)} />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-card bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
          {[
            { icon: IconShieldCheck, text: "Dana kembali 100% kalau penjual gagal kirim." },
            { icon: IconInfo, text: "Robux gamepass berstatus pending 3–7 hari di sisi Roblox." },
            { icon: IconLock, text: "Bukti serah terima dibubuhi watermark resmi per order." },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-2.5 text-[11px] text-ink-dim">
              <item.icon size={14} className="mt-0.5 shrink-0 text-astra-ink" />
              {item.text}
            </div>
          ))}
          <Link
            href="/katalog"
            className="mt-1 text-[11px] text-ink-mute underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            Ganti produk
          </Link>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: "astra" }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-ink-mute">{label}</span>
      <span className={cx("num", tone === "astra" ? "text-astra-ink" : "text-ink-dim")}>{value}</span>
    </div>
  );
}

function Timer({ expirySeconds, onExpire }: { expirySeconds: number; onExpire?: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-well bg-robux/[0.06] px-3.5 py-2.5 outline outline-1 -outline-offset-1 outline-robux/20">
      <span className="text-[11px] text-ink-dim">Tagihan kedaluwarsa dalam</span>
      <Countdown seconds={expirySeconds} onExpire={onExpire} />
    </div>
  );
}
