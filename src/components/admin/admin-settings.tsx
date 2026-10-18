"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateBanks,
  updatePaymentFees,
  updateSweepTimeouts,
  updateWithdrawalConfig,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, TextInput, TextArea } from "@/components/ui/field";
import { IconAlert, IconCheck } from "@/components/ui/icons";

export interface AdminSettingsInitial {
  fees: { qris: number; va: number; ewallet: number };
  withdrawal: { minAmount: number; fee: number };
  banks: string[];
  timeouts: { poolHours: number; processingDays: number; assignedHours: number };
}

function toNumber(raw: string): number | null {
  const value = Number(raw.replace(",", ".").trim());
  return Number.isFinite(value) ? value : null;
}

/** Editors for the platform key-value settings (previously DB-only). */
export function SettingsPanel({ initial }: { initial: AdminSettingsInitial }) {
  const router = useRouter();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const [qris, setQris] = useState(String(initial.fees.qris));
  const [va, setVa] = useState(String(initial.fees.va));
  const [ewallet, setEwallet] = useState(String(initial.fees.ewallet));
  const [minAmount, setMinAmount] = useState(String(initial.withdrawal.minAmount));
  const [wdFee, setWdFee] = useState(String(initial.withdrawal.fee));
  const [banks, setBanks] = useState(initial.banks.join("\n"));
  const [poolHours, setPoolHours] = useState(String(initial.timeouts.poolHours));
  const [processingDays, setProcessingDays] = useState(String(initial.timeouts.processingDays));
  const [assignedHours, setAssignedHours] = useState(String(initial.timeouts.assignedHours));

  async function run(key: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setPending(key);
    setError(null);
    const result = await fn();
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlash(done);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tersimpan & tercatat">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}

      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-col gap-4 p-4 md:p-5">
          <span className="eyebrow text-ink-mute">Biaya gateway per metode (Rp)</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="QRIS" htmlFor="fee-qris">
              <TextInput id="fee-qris" inputMode="numeric" value={qris} onChange={(e) => setQris(e.target.value)} />
            </Field>
            <Field label="Virtual Account" htmlFor="fee-va">
              <TextInput id="fee-va" inputMode="numeric" value={va} onChange={(e) => setVa(e.target.value)} />
            </Field>
            <Field label="E-Wallet" htmlFor="fee-ewallet">
              <TextInput id="fee-ewallet" inputMode="numeric" value={ewallet} onChange={(e) => setEwallet(e.target.value)} />
            </Field>
          </div>
          <Button
            size="sm"
            className="w-fit"
            disabled={pending !== null}
            onClick={() =>
              void run("fees", () => {
                const parsed = { qris: toNumber(qris), va: toNumber(va), ewallet: toNumber(ewallet) };
                if (Object.values(parsed).some((v) => v === null)) {
                  return Promise.resolve({ ok: false as const, error: "Semua biaya wajib angka." });
                }
                return updatePaymentFees({
                  qris: Math.round(parsed.qris as number),
                  va: Math.round(parsed.va as number),
                  ewallet: Math.round(parsed.ewallet as number),
                });
              }, "Biaya gateway diperbarui.")
            }
          >
            {pending === "fees" ? "Menyimpan…" : "Simpan biaya"}
          </Button>
        </div>
      </div>

      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-col gap-4 p-4 md:p-5">
          <span className="eyebrow text-ink-mute">Penarikan penjual</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Minimum (Rp)" htmlFor="wd-min">
              <TextInput id="wd-min" inputMode="numeric" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            </Field>
            <Field label="Biaya admin (Rp)" htmlFor="wd-fee">
              <TextInput id="wd-fee" inputMode="numeric" value={wdFee} onChange={(e) => setWdFee(e.target.value)} />
            </Field>
          </div>
          <Button
            size="sm"
            className="w-fit"
            disabled={pending !== null}
            onClick={() =>
              void run("wd", () => {
                const min = toNumber(minAmount);
                const fee = toNumber(wdFee);
                if (min === null || fee === null) {
                  return Promise.resolve({ ok: false as const, error: "Minimum dan biaya wajib angka." });
                }
                return updateWithdrawalConfig({ minAmount: Math.round(min), fee: Math.round(fee) });
              }, "Konfigurasi penarikan diperbarui.")
            }
          >
            {pending === "wd" ? "Menyimpan…" : "Simpan penarikan"}
          </Button>
        </div>
      </div>

      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-col gap-4 p-4 md:p-5">
          <Field label="Daftar bank / e-wallet" htmlFor="banks" hint="Satu nama per baris, sesuai urutan tampil">
            <TextArea id="banks" value={banks} rows={4} onChange={(e) => setBanks(e.target.value)} />
          </Field>
          <Button
            size="sm"
            className="w-fit"
            disabled={pending !== null}
            onClick={() =>
              void run("banks", () => updateBanks({ banks: banks.split("\n") }), "Daftar bank diperbarui.")
            }
          >
            {pending === "banks" ? "Menyimpan…" : "Simpan bank"}
          </Button>
        </div>
      </div>

      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-col gap-4 p-4 md:p-5">
          <span className="eyebrow text-ink-mute">Jendela refund otomatis (sweep)</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Pool tak diklaim (jam)" htmlFor="sw-pool">
              <TextInput id="sw-pool" inputMode="decimal" value={poolHours} onChange={(e) => setPoolHours(e.target.value)} />
            </Field>
            <Field label="Processing macet (hari)" htmlFor="sw-proc">
              <TextInput id="sw-proc" inputMode="decimal" value={processingDays} onChange={(e) => setProcessingDays(e.target.value)} />
            </Field>
            <Field label="Assigned tak dimulai (jam)" htmlFor="sw-assigned">
              <TextInput id="sw-assigned" inputMode="decimal" value={assignedHours} onChange={(e) => setAssignedHours(e.target.value)} />
            </Field>
          </div>
          <Button
            size="sm"
            className="w-fit"
            disabled={pending !== null}
            onClick={() =>
              void run("sweep", () => {
                const parsed = {
                  poolHours: toNumber(poolHours),
                  processingDays: toNumber(processingDays),
                  assignedHours: toNumber(assignedHours),
                };
                if (Object.values(parsed).some((v) => v === null)) {
                  return Promise.resolve({ ok: false as const, error: "Semua jendela wajib angka." });
                }
                return updateSweepTimeouts(parsed as { poolHours: number; processingDays: number; assignedHours: number });
              }, "Jendela sweep diperbarui.")
            }
          >
            {pending === "sweep" ? "Menyimpan…" : "Simpan jendela"}
          </Button>
        </div>
      </div>
    </div>
  );
}
