"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSellerListing, setListingListed, updateSellerListing } from "@/app/actions/seller";
import type { SellerInventoryItem } from "@/lib/seller";
import type { DeliveryKind } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Badge, LivePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { IconAlert, IconCheck, IconPackage } from "@/components/ui/icons";

const DELIVERY_LABELS: Record<string, string> = {
  gamepass_auto: "Gamepass otomatis",
  manual: "Manual",
  instant_code: "Kode instan",
  credential: "Akun / kredensial",
};

export function ListingManager({ items: initial }: { items: SellerInventoryItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(id: string, task: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  function toggleListed(item: SellerInventoryItem) {
    setConfirmDeleteId(null);
    run(item.id, () => setListingListed({ productId: item.id, listed: !item.isListed }));
  }

  function remove(item: SellerInventoryItem) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    setConfirmDeleteId(null);
    run(item.id, async () => {
      const result = await deleteSellerListing(item.id);
      if (result.ok) setItems((prev) => prev.filter((row) => row.id !== item.id));
      return result;
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<IconPackage size={22} />}
        title="Belum ada listing"
        description="Buat listing pertamamu lewat form di atas. Langsung tayang di katalog selama toko online."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />}>
          {error}
        </Notice>
      ) : null}

      <div className="flex flex-col divide-y divide-line rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[13px] font-bold text-ink">{item.title}</span>
                <span className="num text-[10px] text-ink-mute">
                  {item.game} · {formatIDR(item.price)} · stok {item.stock}
                </span>
              </div>
              {item.isListed ? (
                item.stock === 0 ? (
                  <Badge tone="danger">stok habis</Badge>
                ) : item.stock < 20 ? (
                  <Badge tone="warn">stok tipis</Badge>
                ) : (
                  <LivePill tone="astra" label="tayang" />
                )
              ) : (
                <Badge tone="neutral">dijeda</Badge>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => {
                    setConfirmDeleteId(null);
                    setEditingId((current) => (current === item.id ? null : item.id));
                  }}
                >
                  {editingId === item.id ? "Tutup" : "Edit"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => toggleListed(item)}
                >
                  {busyId === item.id ? "…" : item.isListed ? "Jeda" : "Tayangkan"}
                </Button>
                <Button
                  variant={confirmDeleteId === item.id ? "danger" : "ghost"}
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => remove(item)}
                >
                  {busyId === item.id
                    ? "…"
                    : confirmDeleteId === item.id
                      ? "Yakin hapus?"
                      : "Hapus"}
                </Button>
              </div>
            </div>

            {editingId === item.id ? (
              <ListingEditor
                item={item}
                disabled={isPending}
                onDone={() => {
                  setEditingId(null);
                  router.refresh();
                }}
                onError={setError}
              />
            ) : null}
          </div>
        ))}
      </div>
      <p className={cx("text-[11px] text-ink-mute")}>
        Listing yang dijeda hilang dari katalog tapi riwayat pesanan tetap utuh. Hapus permanen hanya
        bisa bila tidak ada pesanan berjalan.
      </p>
    </div>
  );
}

function ListingEditor({
  item,
  disabled,
  onDone,
  onError,
}: {
  item: SellerInventoryItem;
  disabled: boolean;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [price, setPrice] = useState(String(item.price));
  const [stock, setStock] = useState(String(item.stock));
  const [deliveryKind, setDeliveryKind] = useState(item.deliveryKind);
  const [description, setDescription] = useState(item.description);
  const [autoReleaseHours, setAutoReleaseHours] = useState(String(item.autoReleaseHours));
  const [instantDelivery, setInstantDelivery] = useState(item.instantDelivery);
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl);
  const [imageTouched, setImageTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    onError(null);
    setSaving(true);
    try {
      const result = await updateSellerListing({
        productId: item.id,
        title,
        price: Number(price.replace(/\D/g, "")),
        stock: Number(stock.replace(/\D/g, "")),
        deliveryKind,
        description,
        autoReleaseHours: Number(autoReleaseHours.replace(/\D/g, "")) || 24,
        instantDelivery,
        // Only send when the seller touched the photo — otherwise keep stored.
        ...(imageTouched ? { imageUrl } : {}),
      });
      if (!result.ok) {
        onError(result.error);
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-well bg-paper p-4 outline outline-1 -outline-offset-1 outline-line">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Judul" htmlFor={`edit-title-${item.id}`} className="md:col-span-2">
          <TextInput
            id={`edit-title-${item.id}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Harga (Rp)" htmlFor={`edit-price-${item.id}`}>
          <TextInput
            id={`edit-price-${item.id}`}
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Stok" htmlFor={`edit-stock-${item.id}`}>
          <TextInput
            id={`edit-stock-${item.id}`}
            inputMode="numeric"
            value={stock}
            onChange={(event) => setStock(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Serah terima" htmlFor={`edit-delivery-${item.id}`}>
          <Select
            id={`edit-delivery-${item.id}`}
            value={deliveryKind}
            onChange={(event) => setDeliveryKind(event.target.value as DeliveryKind)}
          >
            {Object.entries(DELIVERY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Auto-release (jam)" htmlFor={`edit-release-${item.id}`}>
          <TextInput
            id={`edit-release-${item.id}`}
            inputMode="numeric"
            value={autoReleaseHours}
            onChange={(event) => setAutoReleaseHours(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Deskripsi" htmlFor={`edit-desc-${item.id}`} className="md:col-span-2">
          <TextArea
            id={`edit-desc-${item.id}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
          />
        </Field>
        <div className="md:col-span-2">
          <ImagePicker
            value={imageUrl}
            onChange={(next) => {
              setImageUrl(next);
              setImageTouched(true);
            }}
            label="Foto produk"
          />
        </div>
        <div className="md:col-span-2">
          <Checkbox
            id={`edit-instant-${item.id}`}
            checked={instantDelivery}
            onChange={setInstantDelivery}
            label="Instant delivery"
            description="Tandai badge kilat & prioritaskan di pool."
          />
        </div>
      </div>
      <Button
        size="sm"
        className="w-fit"
        leadingIcon={<IconCheck size={14} />}
        disabled={disabled || saving || !title.trim() || !description.trim()}
        onClick={save}
      >
        {saving ? "Menyimpan…" : "Simpan perubahan"}
      </Button>
    </div>
  );
}
