"use client";

import { useState, useTransition } from "react";
import { createTopUp } from "@/app/actions/topup";
import { TOPUP_LIMITS } from "@/lib/topup-limits";
import { formatIDR } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import {
  IconAlert,
  IconArrowRight,
  IconCheckCircle,
  IconHexCoin,
} from "@/components/ui/icons";

const QUICK_AMOUNTS = [25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

/** Wallet top-up: pick an amount, pay via gateway, saldo masuk otomatis. */
export function TopUpPanel({
  balanceAvailable,
  methodFees,
}: {
  balanceAvailable: number;
  methodFees: Record<"qris" | "va" | "ewallet", number>;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"qris" | "va" | "ewallet">("qris");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const numeric = Number(amount.replace(/\D/g, ""));
  const methodFee = methodFees[method] ?? 0;

  function start() {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const result = await createTopUp({ amount: numeric, paymentMethod: method });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // checkoutUrl is always absolute (gateway or sim invoice) — hand off.
      window.location.assign(result.checkoutUrl);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold text-ink">Isi ulang saldo</span>
          <span className="text-[11px] text-ink-mute">
            Saldo {formatIDR(balanceAvailable)} siap dipakai untuk belanja dengan metode Saldo Akun.
          </span>
        </div>
        {!open ? (
          <Button
            size="sm"
            leadingIcon={<IconHexCoin size={14} />}
            onClick={() => {
              setOpen(true);
              setError(null);
              setFlash(null);
            }}
          >
            Top-up
          </Button>
        ) : null}
      </div>

      {flash ? (
        <Notice tone="astra" icon={<IconCheckCircle size={15} />}>
          {flash}
        </Notice>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-4 rounded-2xl bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
          {error ? (
            <Notice tone="danger" icon={<IconAlert size={15} />}>
              {error}
            </Notice>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className={cx(
                  "num rounded-xl px-3 py-2.5 text-[12px] font-bold transition-colors duration-200",
                  numeric === value
                    ? "bg-astra text-white"
                    : "bg-paper text-ink-dim outline outline-1 -outline-offset-1 outline-line hover:text-ink",
                )}
              >
                {formatIDR(value)}
              </button>
            ))}
          </div>

          <Field
            label="Nominal lain"
            htmlFor="topup-amount"
            hint={`Min ${formatIDR(TOPUP_LIMITS.min)} · maks ${formatIDR(TOPUP_LIMITS.max)} sekali transaksi.`}
          >
            <TextInput
              id="topup-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
              placeholder="100000"
              className="num"
            />
          </Field>

          <Field label="Metode bayar" htmlFor="topup-method">
            <Select
              id="topup-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as typeof method)}
            >
              <option value="qris">QRIS (tanpa biaya)</option>
              <option value="va">Virtual Account</option>
              <option value="ewallet">E-Wallet</option>
            </Select>
          </Field>

          <div className="flex items-center justify-between rounded-xl bg-paper px-3.5 py-2.5 text-[11px] outline outline-1 -outline-offset-1 outline-line">
            <span className="text-ink-mute">
              Total bayar{" "}
              {numeric > 0 ? `(nominal ${formatIDR(numeric)} + biaya ${formatIDR(methodFee)})` : ""}
            </span>
            <span className="num font-extrabold text-astra-ink">
              {formatIDR(numeric > 0 ? numeric + methodFee : 0)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              disabled={isPending || numeric < TOPUP_LIMITS.min || numeric > TOPUP_LIMITS.max}
              onClick={start}
              trailingIcon={<IconArrowRight size={14} />}
            >
              {isPending ? "Memproses…" : `Bayar ${numeric > 0 ? formatIDR(numeric) : ""}`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
