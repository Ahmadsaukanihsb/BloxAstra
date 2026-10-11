"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatIDR } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { requestWithdrawal } from "@/app/actions/wallet";
import { IconAlert, IconBank, IconCheckCircle, IconX } from "@/components/ui/icons";

export function WithdrawDialog({
  open,
  onClose,
  balanceAvailable,
  banks,
  minAmount,
  fee,
}: {
  open: boolean;
  onClose: () => void;
  balanceAvailable: number;
  banks: string[];
  minAmount: number;
  fee: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bank, setBank] = useState(banks[0] ?? "BCA");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const numericAmount = Number(amount.replace(/\D/g, ""));
  const appliedFee = numericAmount > 0 ? fee : 0;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function submit() {
    setError(null);
    if (numericAmount < minAmount) {
      setError(`Minimum penarikan ${formatIDR(minAmount)}.`);
      return;
    }
    if (numericAmount + appliedFee > balanceAvailable) {
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
      router.refresh();
    });
  }

  function reset() {
    setSubmittedRef(null);
    setError(null);
    setAccount("");
    setAmount("");
    onClose();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm"
          onClick={reset}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Tarik dana"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-card bg-paper p-6 outline outline-1 -outline-offset-1 outline-line shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)]"
          >
            {submittedRef ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-astra/10 text-astra-ink">
                  <IconCheckCircle size={26} />
                </span>
                <div className="flex flex-col gap-1.5">
                  <p className="text-base font-extrabold text-ink">Penarikan diajukan</p>
                  <p className="text-[12px] leading-relaxed text-ink-mute">
                    Referensi <span className="num font-bold text-ink">{submittedRef}</span> sudah
                    masuk antrean. Admin akan memprosesnya. Saldo sudah dipotong saat pengajuan.
                  </p>
                </div>
                <Button size="sm" onClick={reset}>
                  Selesai
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-[13px] font-extrabold text-ink">
                      <IconBank size={16} className="text-astra-ink" />
                      Tarik dana
                    </span>
                    <span className="num text-[11px] text-ink-mute">
                      saldo tersedia {formatIDR(balanceAvailable)} · biaya admin {formatIDR(fee)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    aria-label="Tutup"
                    className="grid size-8 shrink-0 place-items-center rounded-full text-ink-mute transition-colors duration-200 hover:bg-canvas hover:text-ink"
                  >
                    <IconX size={16} />
                  </button>
                </div>

                {error ? (
                  <Notice tone="danger" icon={<IconAlert size={15} />}>
                    {error}
                  </Notice>
                ) : null}

                <Field label="Bank / e-wallet" htmlFor="withdraw-bank">
                  <Select
                    id="withdraw-bank"
                    value={bank}
                    onChange={(event) => setBank(event.target.value)}
                  >
                    {banks.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Nomor rekening"
                  htmlFor="withdraw-account"
                  hint="8–20 digit, milikmu sendiri."
                >
                  <TextInput
                    id="withdraw-account"
                    inputMode="numeric"
                    placeholder="1234567890"
                    value={account}
                    onChange={(event) => setAccount(event.target.value.replace(/\D/g, ""))}
                    invalid={account.length > 0 && account.length < 8}
                  />
                </Field>

                <Field
                  label="Nominal penarikan"
                  htmlFor="withdraw-amount"
                  hint={
                    numericAmount > 0
                      ? `Biaya admin ${formatIDR(appliedFee)} · total potong ${formatIDR(numericAmount + appliedFee)}`
                      : `Minimum ${formatIDR(minAmount)}`
                  }
                >
                  <TextInput
                    id="withdraw-amount"
                    inputMode="numeric"
                    placeholder="50000"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
                    invalid={numericAmount > 0 && numericAmount < minAmount}
                  />
                </Field>

                <div className="flex flex-wrap gap-2.5">
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    onClick={reset}
                    disabled={isPending}
                  >
                    Batal
                  </Button>
                  <Button
                    size="md"
                    className={cx("flex-1")}
                    disabled={isPending || numericAmount <= 0}
                    onClick={submit}
                  >
                    {isPending ? "Mengajukan…" : "Ajukan penarikan"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
