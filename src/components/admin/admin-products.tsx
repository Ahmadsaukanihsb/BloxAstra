"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProductFeaturedAdmin, setProductListedAdmin } from "@/app/actions/admin";
import type { AdminProductRow } from "@/lib/admin";
import { RecordFrame } from "@/components/admin/console";
import { ProductImageEditor } from "@/components/admin/product-image-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { formatIDR, formatNumber } from "@/lib/format";
import { IconAlert, IconCheck, IconEye, IconEyeOff, IconStar, IconUpload } from "@/components/ui/icons";

/**
 * Newest listings with takedown / restore and pin / unpin controls.
 * Takedown only flips `isListed` — running orders keep their product
 * reference, so history never breaks.
 */
export function ProductsPanel({ initial }: { initial: AdminProductRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [imageOpenFor, setImageOpenFor] = useState<string | null>(null);

  async function toggleListed(row: AdminProductRow) {
    const result = await setProductListedAdmin({ productId: row.id, listed: !row.isListed });
    if (!result.ok) {
      setFlash(result.error);
      return;
    }
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, isListed: !item.isListed } : item)));
    setFlash(row.isListed ? `${row.title} diturunkan dari katalog.` : `${row.title} ditayangkan kembali.`);
    router.refresh();
  }

  async function toggleFeatured(row: AdminProductRow) {
    const result = await setProductFeaturedAdmin({ productId: row.id, featured: !row.featured });
    if (!result.ok) {
      setFlash(result.error);
      return;
    }
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, featured: !item.featured } : item)));
    setFlash(row.featured ? `${row.title} dilepas dari sorotan.` : `${row.title} dipin ke sorotan.`);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconEye size={22} />}
        title="Belum ada listing"
        description="Listing yang dibuat penjual muncul di sini untuk dimoderasi."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {flash ? (
        <p className="text-[12px] font-bold text-astra-ink">{flash}</p>
      ) : null}
      {rows.map((row) => (
        <RecordFrame key={row.id} tone={row.isListed ? "neutral" : "warn"}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[13px] font-extrabold text-ink">{row.title}</span>
            {row.isListed ? null : (
              <Badge tone="warn" icon={<IconEyeOff size={13} />}>
                Diturunkan
              </Badge>
            )}
            {row.featured ? (
              <Badge tone="astra" icon={<IconStar size={13} />}>
                Sorotan
              </Badge>
            ) : null}
            <span className="num ml-auto text-[11px] text-ink-mute">
              {row.sellerStoreName} · {row.game}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-mute">
            <span className="num">
              {formatIDR(row.price)} · stok {formatNumber(row.stock)} · terjual {formatNumber(row.sold)}
            </span>
            <span className="num truncate">/{row.slug}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<IconUpload size={15} />}
              onClick={() => setImageOpenFor((prev) => (prev === row.id ? null : row.id))}
            >
              {imageOpenFor === row.id ? "Tutup foto" : row.imageUrl ? "Ganti foto" : "Atur foto"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={row.isListed ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              onClick={() => void toggleListed(row)}
            >
              {row.isListed ? "Turunkan" : "Tayangkan"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={row.featured ? <IconAlert size={15} /> : <IconStar size={15} />}
              onClick={() => void toggleFeatured(row)}
            >
              {row.featured ? "Lepas sorotan" : "Jadikan sorotan"}
            </Button>
          </div>
          {imageOpenFor === row.id ? (
            <ProductImageEditor
              productId={row.id}
              title={row.title}
              imageUrl={row.imageUrl}
              onSaved={(next) => {
                setRows((prev) =>
                  prev.map((item) => (item.id === row.id ? { ...item, imageUrl: next } : item)),
                );
                setFlash(next ? `Foto ${row.title} diperbarui.` : `Foto ${row.title} dihapus.`);
                router.refresh();
              }}
            />
          ) : null}
        </RecordFrame>
      ))}
      <p className="flex items-center gap-2 text-[11px] text-ink-mute">
        <IconCheck size={14} className="text-success" />
        Menampilkan {rows.length} listing terbaru. Cari listing lama lewat pencarian admin.
      </p>
    </div>
  );
}
