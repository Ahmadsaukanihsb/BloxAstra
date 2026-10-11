"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatIDR, formatDateTime } from "@/lib/format";
import type { WalletView as WalletData } from "@/lib/wallet";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { TopUpPanel } from "@/components/wallet/topup-panel";
import { requestWithdrawal } from "@/app/actions/wallet";
import {
  IconArrowRight,
  IconBank,
  IconCheckCircle,
  IconInfo,
  IconLock,
  IconReceipt,
} from "@/components/ui/icons";

const TYPE_META: Record<
  string,
  { label: string; tone: "astra" | "danger" | "info" | "warn" | "robux" }
> = {
  earning: { label: "Pencairan dana", tone: "astra" },
  withdrawal: { label: "Penarikan", tone: "info" },
  purchase: { label: "Belanja saldo", tone: "info" },
  penalty_debt: { label: "Debit paksa", tone: "danger" },
  protection_bailout: { label: "Talangan platform", tone: "warn" },
  refund: { label: "Refund pembeli", tone: "robux" },
  topup: { label: "Top-up saldo", tone: "astra" },
};

export function WalletView({
  wallet,
  methodFees,
  embedded = false,
}: {
  wallet: WalletData;
  methodFees: Record<"qris" | "va" | "ewallet", number>;
  /**
   * Rendered inside the seller dashboard shell, which already supplies the
   * page container, spacing and heading. Standalone /dompet keeps its own.
   */
  embedded?: boolean;
}) {
  const router = useRouter();
  const { minAmount: MIN_AMOUNT, fee: FEE } = wallet.withdrawal;
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"semua" | "earning" | "withdrawal" | "penalty">("semua");
  const [bank, setBank] = useState(wallet.banks[0] ?? "BCA");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedRef, setSubmittedRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount.replace(/\D/g, ""));
  const fee = numericAmount > 0 ? FEE : 0;
  const entries = wallet.entries.filter((entry) => {
    if (filter === "semua") return true;
    if (filter === "penalty") return entry.type === "penalty_debt" || entry.type === "refund";
    if (filter === "withdrawal") return entry.type === "withdrawal" || entry.type === "purchase";
    return entry.type === filter;
  });

  // negativeDebt is aggregated server-side over the whole ledger, so the button
  // stays disabled even after the penalty row scrolls past the 50-entry window.
  const blocked = wallet.negativeDebt > 0;

  function submit() {
    setError(null);
    if (numericAmount < MIN_AMOUNT) {
      setError(`Minimum penarikan ${formatIDR(MIN_AMOUNT)}.`);
      return;
    }
    if (numericAmount + fee > wallet.balanceAvailable) {
      setError("Nominal melebihi saldo yang bisa ditarik (termasuk biaya).");
      return;
    }
    if (account.replace(/\D/g, "").length < 8) {
      setError("Nomor rekening minimal 8 digit.");
      return;
    }
    startTransition(async () => {
      const result = await requestWithdrawal({
        bank,
        accountNumber: account.replace(/\D/g, ""),
        amount: numericAmount,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubmittedRef(result.ref);
      setSubmitted(true);
      router.refresh();
    });
  }

  return (
    <div
      className={
        embedded
          ? "flex flex-col gap-8"
          : "shell pb-24 pt-24 md:pt-28"
      }
    >
      <div className="flex flex-col gap-8">
        {embedded ? null : (
          <div className="flex flex-col gap-3">
 <h1 className="font-display text-page font-extrabold text-ink md:text-page">
              Dompet & penarikan
            </h1>
            <p className="max-w-[66ch] text-[13px] leading-relaxed text-ink-dim">
              Setiap mutasi menyimpan saldo setelah transaksi, jadi riwayat saldo bisa ditelusuri
              baris demi baris dan tidak ada angka yang bisa ditimpa.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            <div className="bezel-shell bg-astra/[0.03] p-1.5">
              <div className="bezel-core flex flex-col gap-2 p-5">
                <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                  Bisa ditarik
                </span>
                <span className="num text-[26px] font-extrabold text-astra-ink">
                  {formatIDR(wallet.balanceAvailable)}
                </span>
                <span className="text-[11px] text-ink-mute">
                  Diajukan kapan saja. Admin mentransfer manual ke rekening yang kamu daftarkan
                </span>
              </div>
            </div>

            <div className="bezel-shell p-1.5">
              <div className="bezel-core flex flex-col gap-2 p-5">
                <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                  Ditahan platform
                </span>
                <span className="num text-[26px] font-extrabold text-robux">
                  {formatIDR(wallet.balanceLocked)}
                </span>
                <span className="text-[11px] text-ink-mute">
                  Cair otomatis setelah pembeli konfirmasi atau masa tunggu berakhir
                </span>
              </div>
            </div>

            <div className="bezel-shell p-1.5">
              <div className="bezel-core flex flex-col gap-2 p-5">
                <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                  Piutang negatif
                </span>
                <span className="num text-[26px] font-extrabold text-danger">
                  {wallet.negativeDebt > 0 ? `−${formatIDR(wallet.negativeDebt)}` : formatIDR(0)}
                </span>
                <span className="text-[11px] text-ink-mute">
                  Selama minus, pengajuan penarikan dinonaktifkan sampai pelunasan dicatat admin
                </span>
              </div>
            </div>
        </div>

        {blocked ? (
          <Notice tone="danger" icon={<IconInfo size={15} />} title="Ada debit paksa yang belum diselesaikan">
            Saldo dompetmu minus karena admin mencatat piutang pada sengketa yang dimenangkan
            pembeli. Selama masih minus, pengajuan penarikan dinonaktifkan sampai admin mencatat
            pelunasan.
          </Notice>
        ) : null}

        <div className="bezel-shell p-1.5">
          <div className="bezel-core p-5">
            <TopUpPanel balanceAvailable={wallet.balanceAvailable} methodFees={methodFees} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
                  <IconReceipt size={16} className="text-astra-ink" />
                  Mutasi dompet
                </span>
                <div className="flex gap-1.5 rounded-full bg-canvas p-1 outline outline-1 -outline-offset-1 outline-line">
                  {(
                    [
                      { id: "semua", label: "Semua" },
                      { id: "earning", label: "Masuk" },
                      { id: "withdrawal", label: "Keluar" },
                      { id: "penalty", label: "Penalti" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFilter(option.id)}
                      className={cx(
                        "relative isolate rounded-full px-3 py-1.5 text-[11px] transition-colors duration-300",
                        filter === option.id ? "text-white" : "text-ink-dim hover:text-ink",
                      )}
                    >
                      {filter === option.id ? (
                        <motion.span
                          layoutId="wallet-filter"
                          transition={{ type: "spring", stiffness: 320, damping: 30 }}
                          className="absolute inset-0 -z-10 rounded-full bg-astra"
                        />
                      ) : null}
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {entries.length === 0 ? (
                <EmptyState
                  icon={<IconReceipt size={22} />}
                  title="Belum ada mutasi di kategori ini"
                  description="Pilih kategori lain atau mulai selesaikan pesanan supaya saldo dompet bertambah."
                />
              ) : (
                <div className="flex flex-col divide-y divide-line">
                  {entries.map((entry) => {
                    const meta = TYPE_META[entry.type] ?? { label: entry.type, tone: "info" as const };
                    const positive = entry.amount > 0;
                    return (
                      <div key={entry.id} className="flex items-start gap-4 py-4 first:pt-0">
                        <span
                          className={cx(
                            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-control",
                            positive ? "bg-astra/10 text-astra-ink" : "bg-danger/10 text-danger",
                          )}
                        >
                          {positive ? <IconArrowRight size={15} /> : <IconLock size={15} />}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12px] font-bold text-ink">{meta.label}</span>
                            {entry.orderCode ? (
                              <span className="num text-[10px] text-ink-mute">
                                {entry.orderCode}
                              </span>
                            ) : null}
                            <Badge tone={meta.tone}>ledger</Badge>
                          </div>
                          <span className="text-[11px] leading-relaxed text-ink-mute">
                            {entry.note}
                          </span>
                          <span className="num text-[10px] text-ink-mute">
                            {formatDateTime(entry.createdAt)}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={cx(
                              "num text-[13px] font-extrabold",
                              positive ? "text-astra-ink" : "text-danger",
                            )}
                          >
                            {positive ? "+" : "−"}
                            {formatIDR(Math.abs(entry.amount))}
                          </span>
                          <span className="num text-[10px] text-ink-mute">
                            saldo {formatIDR(entry.balanceAfter)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-28">
            <div className="bezel-shell p-1.5">
              <div className="bezel-core flex flex-col gap-5 p-5">
                <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
                  <IconBank size={16} className="text-astra-ink" />
                  Ajukan penarikan
                </span>

                {submitted ? (
                  <div className="flex flex-col gap-4 rounded-well bg-astra/[0.07] p-4 outline outline-1 -outline-offset-1 outline-astra/25">
                    <div className="flex items-start gap-3">
                      <IconCheckCircle size={19} className="mt-0.5 shrink-0 text-astra-ink" />
                      <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-bold text-ink">
                          Penarikan diajukan · menunggu admin
                        </span>
                        <span className="num text-[11px] text-ink-mute">
                          {submittedRef} · {formatIDR(numericAmount)} ke {bank} ····{account.slice(-4)}
                        </span>
                        <span className="text-[11px] leading-relaxed text-ink-mute">
                          Pengajuan masuk antrean admin dan saldo sudah dipotong saat ini. Kalau
                          ditolak, nominal beserta biaya dikembalikan ke dompet.
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSubmitted(false);
                        setAmount("");
                        setAccount("");
                      }}
                    >
                      Ajukan penarikan lain
                    </Button>
                  </div>
                ) : (
                  <>
                    {error ? (
                      <Notice tone="danger" icon={<IconInfo size={15} />}>
                        {error}
                      </Notice>
                    ) : null}
                    <Field
                      label="Bank / e-wallet tujuan"
                      htmlFor="bank-select"
                      hint={`Biaya admin ${formatIDR(FEE)} per penarikan.`}
                    >
                      <Select
                        id="bank-select"
                        value={bank}
                        onChange={(event) => setBank(event.target.value)}
                      >
                        {wallet.banks.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field
                      label="Nomor rekening / e-wallet"
                      htmlFor="account"
                      hint="Nama pemilik rekening harus sama dengan identitas KYC."
                    >
                      <TextInput
                        id="account"
                        value={account}
                        onChange={(event) => setAccount(event.target.value)}
                        inputMode="numeric"
                        placeholder="447188923310"
                      />
                    </Field>

                    <Field
                      label="Nominal"
                      htmlFor="amount"
                      hint={`Minimum ${formatIDR(MIN_AMOUNT)}. Saldo tersedia otomatis dipotong biaya disbursement.`}
                    >
                      <TextInput
                        id="amount"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        className="num"
                        placeholder="500000"
                      />
                    </Field>

                    <div className="flex flex-col gap-2 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-mute">Nominal</span>
                        <span className="num text-ink-dim">{formatIDR(numericAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-mute">Biaya</span>
                        <span className="num text-ink-dim">{formatIDR(fee)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-line pt-2.5">
                        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-mute">
                          Diterima
                        </span>
                        <span className="num text-[15px] font-extrabold text-astra-ink">
                          {formatIDR(Math.max(0, numericAmount - fee))}
                        </span>
                      </div>
                    </div>

                    <Button size="lg" fullWidth onClick={submit} disabled={isPending || blocked}>
                      {blocked ? "Dinonaktifkan: ada debit paksa" : "Ajukan penarikan"}
                    </Button>

                    <p className="text-[11px] leading-relaxed text-ink-mute">
                      Pengajuan langsung masuk antrean admin. Saldo dipotong saat diajukan; bila
                      ditolak, nominal beserta biaya kembali ke dompet.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
