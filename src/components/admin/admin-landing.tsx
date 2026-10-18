"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveLandingLayout } from "@/app/actions/admin";
import { LANDING_SECTIONS, type LandingSectionId } from "@/lib/landing-sections-slots";
import type { LandingLayout } from "@/lib/landing-sections";
import { RecordFrame } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { cx } from "@/lib/cx";
import { IconAlert, IconCheck, IconChevronRight, IconEye, IconEyeOff } from "@/components/ui/icons";

/**
 * Homepage arrangement editor: reorder sections below the hero and hide the
 * ones the shop does not need right now (testimonials included — hiding it
 * is the same as "hide reviews"). The hero itself is always first.
 */
export function LandingPanel({ initial }: { initial: LandingLayout }) {
  const router = useRouter();
  const [order, setOrder] = useState<LandingSectionId[]>(initial.order);
  const [hidden, setHidden] = useState<Set<LandingSectionId>>(new Set(initial.hidden));
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty =
    JSON.stringify(order) !== JSON.stringify(initial.order) ||
    JSON.stringify([...hidden].sort()) !== JSON.stringify([...new Set(initial.hidden)].sort());

  function move(id: LandingSectionId, direction: -1 | 1) {
    setOrder((prev) => {
      const index = prev.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleHidden(id: LandingSectionId) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    setPending(true);
    setError(null);
    const result = await saveLandingLayout({ order, hidden: [...hidden] });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlash("Susunan beranda diperbarui.");
    router.refresh();
  }

  const labelOf = (id: LandingSectionId) =>
    LANDING_SECTIONS.find((section) => section.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tersimpan">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}

      <RecordFrame>
        <span className="eyebrow text-ink-mute">Urutan section (di bawah hero, atas ke bawah)</span>
        <div className="flex flex-col gap-2">
          {order.map((id, index) => {
            const isHidden = hidden.has(id);
            return (
              <div
                key={id}
                className={cx(
                  "flex items-center gap-2.5 rounded-well px-3.5 py-2.5 outline outline-1 -outline-offset-1",
                  isHidden ? "bg-canvas-2 opacity-70 outline-line" : "bg-paper outline-line-strong",
                )}
              >
                <span className="num w-6 text-[11px] font-extrabold text-ink-mute">{index + 1}</span>
                <span className="flex-1 text-[13px] font-bold text-ink">{labelOf(id)}</span>
                {isHidden ? (
                  <Badge tone="muted" icon={<IconEyeOff size={13} />}>
                    Disembunyikan
                  </Badge>
                ) : null}
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Naikkan ${labelOf(id)}`}
                    disabled={index === 0}
                    onClick={() => move(id, -1)}
                  >
                    <span className="inline-block -rotate-90">
                      <IconChevronRight size={15} />
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Turunkan ${labelOf(id)}`}
                    disabled={index === order.length - 1}
                    onClick={() => move(id, 1)}
                  >
                    <span className="inline-block rotate-90">
                      <IconChevronRight size={15} />
                    </span>
                  </Button>
                  <Button
                    variant={isHidden ? "secondary" : "ghost"}
                    size="sm"
                    aria-label={isHidden ? `Tampilkan ${labelOf(id)}` : `Sembunyikan ${labelOf(id)}`}
                    leadingIcon={<IconEye size={15} />}
                    onClick={() => toggleHidden(id)}
                  >
                    {isHidden ? "Tampilkan" : "Sembunyikan"}
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
        <span className="flex flex-wrap gap-2.5">
          <Button size="sm" leadingIcon={<IconCheck size={15} />} disabled={pending || !dirty} onClick={() => void apply()}>
            {pending ? "Menyimpan…" : "Terapkan susunan"}
          </Button>
          {dirty ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setOrder(initial.order);
                setHidden(new Set(initial.hidden));
              }}
            >
              Batalkan perubahan
            </Button>
          ) : null}
        </span>
      </RecordFrame>

      <Notice tone="info" icon={<IconAlert size={15} />} title="Catatan">
        Hero selalu paling atas dan tidak bisa disembunyikan. Section ulasan otomatis hilang kalau
        belum ada ulasan ber-kata — tombol di sini untuk menyembunyikannya secara manual.
      </Notice>
    </div>
  );
}
