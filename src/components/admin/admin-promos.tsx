"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPromo, deletePromo, setPromoActive } from "@/app/actions/admin";
import type { AdminPromoRow } from "@/lib/admin";
import { RecordFrame } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/field";
import { formatIDR, formatNumber } from "@/lib/format";
import { IconAlert, IconCheck, IconPlus, IconTrash } from "@/components/ui/icons";

function describe(row: AdminPromoRow): string {
  const cut = row.type === "percent" ? `${row.value}%` : formatIDR(row.value);
  const budget = row.maxUses === null ? "tanpa batas" : `${formatNumber(row.usedCount)}/${formatNumber(row.maxUses)} terpakai`;
  return `${cut} · ${budget}`;
}

/** List, create, enable/disable and delete promo codes. */
export function PromosPanel({ initial }: { initial: AdminPromoRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [code, setCode] = useState("");
  const [type, setType] = useState<"fixed" | "percent">("fixed");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");

  async function handleCreate() {
    setPending(true);
    setError(null);
    const numeric = Number(value.replace(",", "."));
    const uses = maxUses.trim() === "" ? null : Number(maxUses);
    const result = await createPromo({
      code,
      type,
      value: Number.isFinite(numeric) ? Math.round(numeric) : Number.NaN,
      maxUses: uses === null ? null : Number.isFinite(uses) ? Math.round(uses) : Number.NaN,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCode("");
    setValue("");
    setMaxUses("");
    setFlash(`Kode ${code.trim().toUpperCase()} aktif.`);
    router.refresh();
  }

  async function handleToggle(row: AdminPromoRow) {
    const result = await setPromoActive({ code: row.code, active: !row.active });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRows((prev) => prev.map((item) => (item.code === row.code ? { ...item, active: !item.active } : item)));
    setFlash(row.active ? `${row.code} dinonaktifkan.` : `${row.code} diaktifkan.`);
    router.refresh();
  }

  async function handleDelete(row: AdminPromoRow) {
    if (row.usedCount > 0) {
      setError("Sudah pernah dipakai — nonaktifkan saja agar riwayat tetap utuh.");
      return;
    }
    if (!window.confirm(`Hapus kode ${row.code}?`)) return;
    const result = await deletePromo({ code: row.code });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRows((prev) => prev.filter((item) => item.code !== row.code));
    setFlash(`${row.code} dihapus.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tercatat">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}

      <RecordFrame>
        <span className="eyebrow text-ink-mute">Buat kode baru</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Kode" htmlFor="promo-code" hint="3–20 karakter: huruf, angka, _ atau -">
            <TextInput
              id="promo-code"
              value={code}
              placeholder="RAMADHAN10"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Tipe" htmlFor="promo-type">
            <select
              id="promo-type"
              value={type}
              onChange={(event) => setType(event.target.value as "fixed" | "percent")}
              className="w-full rounded-control bg-canvas px-3 py-2.5 text-[13px] text-ink outline outline-1 -outline-offset-1 outline-line"
            >
              <option value="fixed">Nominal (Rp)</option>
              <option value="percent">Persen (1–90)</option>
            </select>
          </Field>
          <Field label={type === "percent" ? "Diskon %" : "Potongan Rp"} htmlFor="promo-value">
            <TextInput
              id="promo-value"
              inputMode="numeric"
              value={value}
              placeholder={type === "percent" ? "10" : "15000"}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <Field label="Batas pakai (opsional)" htmlFor="promo-max" hint="Kosong = tanpa batas">
            <TextInput
              id="promo-max"
              inputMode="numeric"
              value={maxUses}
              placeholder="100"
              onChange={(event) => setMaxUses(event.target.value)}
            />
          </Field>
        </div>
        <Button size="sm" leadingIcon={<IconPlus size={15} />} disabled={pending} onClick={() => void handleCreate()}>
          {pending ? "Menyimpan…" : "Buat kode"}
        </Button>
      </RecordFrame>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconPlus size={22} />}
          title="Belum ada kode promo"
          description="Kode yang dibuat di atas muncul di sini dan langsung bisa dipakai di checkout."
        />
      ) : (
        rows.map((row) => (
          <RecordFrame key={row.code} tone={row.active ? "neutral" : "warn"}>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="num text-[13px] font-extrabold text-ink">{row.code}</span>
              <Badge tone={row.active ? "success" : "muted"}>{row.active ? "Aktif" : "Mati"}</Badge>
              <span className="text-[12px] text-ink-dim">{describe(row)}</span>
              {row.note ? <span className="text-[11px] italic text-ink-mute">“{row.note}”</span> : null}
              <span className="ml-auto flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => void handleToggle(row)}>
                  {row.active ? "Matikan" : "Nyalakan"}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leadingIcon={<IconTrash size={15} />}
                  disabled={row.usedCount > 0}
                  title={row.usedCount > 0 ? "Sudah dipakai — tidak bisa dihapus" : "Hapus kode"}
                  onClick={() => void handleDelete(row)}
                >
                  Hapus
                </Button>
              </span>
            </div>
          </RecordFrame>
        ))
      )}
    </div>
  );
}
