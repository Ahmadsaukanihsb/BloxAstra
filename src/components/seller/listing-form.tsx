"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSellerListing } from "@/app/actions/seller";
import type { Category, CategorySlug, DeliveryKind } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { Notice } from "@/components/ui/feedback";
import { IconAlert, IconCheckCircle, IconPlus } from "@/components/ui/icons";

const DELIVERY_OPTIONS: { value: DeliveryKind; label: string; hint: string }[] = [
  { value: "gamepass_auto", label: "Gamepass otomatis", hint: "sistem serah otomatis lewat gamepass" },
  { value: "manual", label: "Manual", hint: "kirim manual lewat ruang pesanan" },
  { value: "instant_code", label: "Kode instan", hint: "kode langsung dikirim sistem" },
  { value: "credential", label: "Akun / kredensial", hint: "serah username + password" },
];

export function ListingForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [categorySlug, setCategorySlug] = useState<CategorySlug>(categories[0]?.slug ?? "gamepass");
  const [game, setGame] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [deliveryKind, setDeliveryKind] = useState<DeliveryKind>("manual");
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState("");
  const [netRobux, setNetRobux] = useState("");
  const [autoReleaseHours, setAutoReleaseHours] = useState("24");
  const [instantDelivery, setInstantDelivery] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const numericPrice = Number(price.replace(/\D/g, ""));
  const numericStock = Number(stock.replace(/\D/g, ""));
  const numericRobux = Number(netRobux.replace(/\D/g, ""));
  const numericRelease = Number(autoReleaseHours.replace(/\D/g, "")) || 24;

  function reset() {
    setTitle("");
    setGame("");
    setPrice("");
    setStock("10");
    setDescription("");
    setHighlights("");
    setNetRobux("");
    setInstantDelivery(false);
    setImageUrl(null);
    setError(null);
    setCreatedSlug(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const highlightList = highlights
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6);

    startTransition(async () => {
      const result = await createSellerListing({
        title,
        categorySlug,
        game,
        price: numericPrice,
        stock: numericStock,
        deliveryKind,
        description,
        highlights: highlightList,
        netRobux: numericRobux > 0 ? numericRobux : undefined,
        autoReleaseHours: numericRelease,
        instantDelivery,
        imageUrl: imageUrl ?? undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreatedSlug(result.slug);
      router.refresh();
    });
  }

  if (createdSlug) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[1.4rem] bg-canvas px-6 py-12 text-center outline outline-1 -outline-offset-1 outline-line">
        <span className="grid size-14 place-items-center rounded-full bg-astra/10 text-astra-ink">
          <IconCheckCircle size={26} />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-extrabold text-ink">Listing tayang</p>
          <p className="max-w-[40ch] text-[12px] leading-relaxed text-ink-mute">
            Produkmu sudah masuk katalog dengan slug{" "}
            <span className="num font-bold text-ink">{createdSlug}</span>. Pembeli bisa langsung
            checkout kalau toko sedang online.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={reset}>
            Tambah listing lain
          </Button>
          <Button size="sm" onClick={() => router.push(`/produk/${createdSlug}`)}>
            Lihat produk
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal membuat listing">
          {error}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Judul produk" htmlFor="listing-title" className="md:col-span-2">
          <TextInput
            id="listing-title"
            placeholder="Contoh: 1000 Robux via Gamepass — harga bersahabat"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
          />
        </Field>

        <Field label="Kategori" htmlFor="listing-category">
          <Select
            id="listing-category"
            value={categorySlug}
            onChange={(event) => setCategorySlug(event.target.value as CategorySlug)}
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Game" htmlFor="listing-game">
          <TextInput
            id="listing-game"
            placeholder="Roblox"
            value={game}
            onChange={(event) => setGame(event.target.value)}
            maxLength={80}
          />
        </Field>

        <Field
          label="Harga (Rp)"
          htmlFor="listing-price"
          hint={numericPrice > 0 ? formatIDR(numericPrice) : "angka saja, tanpa titik"}
        >
          <TextInput
            id="listing-price"
            inputMode="numeric"
            placeholder="50000"
            value={price}
            onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <Field label="Stok" htmlFor="listing-stock">
          <TextInput
            id="listing-stock"
            inputMode="numeric"
            placeholder="10"
            value={stock}
            onChange={(event) => setStock(event.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <Field label="Metode serah terima" htmlFor="listing-delivery" className="md:col-span-2">
          <Select
            id="listing-delivery"
            value={deliveryKind}
            onChange={(event) => setDeliveryKind(event.target.value as DeliveryKind)}
          >
            {DELIVERY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </option>
            ))}
          </Select>
        </Field>

        {categorySlug === "gamepass" || categorySlug === "item" ? (
          <Field
            label="Net Robux (opsional)"
            htmlFor="listing-robux"
            hint="Isi kalau produk ini paket Robux — harga akan dikutip otomatis dari rate card."
            className="md:col-span-2"
          >
            <TextInput
              id="listing-robux"
              inputMode="numeric"
              placeholder="1000"
              value={netRobux}
              onChange={(event) => setNetRobux(event.target.value.replace(/\D/g, ""))}
            />
          </Field>
        ) : null}

        <Field
          label="Deskripsi"
          htmlFor="listing-description"
          className="md:col-span-2"
          hint="Jelaskan isi, syarat, dan cara klaim produkmu."
        >
          <TextArea
            id="listing-description"
            placeholder="Jelaskan produk, cara klaim, dan syaratnya…"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
          />
        </Field>

        <Field
          label="Highlight (opsional)"
          htmlFor="listing-highlights"
          className="md:col-span-2"
          hint="Satu poin per baris, maksimal 6 baris."
        >
          <TextArea
            id="listing-highlights"
            placeholder={"Proses cepat\nAman & terpercaya\nGaransi refund"}
            value={highlights}
            onChange={(event) => setHighlights(event.target.value)}
          />
        </Field>

        <Field label="Auto-release (jam)" htmlFor="listing-release">
          <TextInput
            id="listing-release"
            inputMode="numeric"
            placeholder="24"
            value={autoReleaseHours}
            onChange={(event) => setAutoReleaseHours(event.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <div className="md:col-span-2">
          <ImagePicker value={imageUrl} onChange={setImageUrl} label="Foto produk (opsional)" />
        </div>

        <div className="flex items-end pb-1">
          <Checkbox
            id="listing-instant"
            checked={instantDelivery}
            onChange={setInstantDelivery}
            label="Instant delivery"
            description="Tandai badge kilat & prioritaskan di pool."
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending || !title.trim() || !game.trim() || numericPrice <= 0}
        leadingIcon={<IconPlus size={15} />}
        className="w-fit"
      >
        {isPending ? "Menerbitkan…" : "Terbitkan listing"}
      </Button>
    </form>
  );
}
