"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSellerProfile } from "@/app/actions/seller";
import { SellerAvatar } from "@/components/ui/art";
import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { ImagePicker } from "@/components/ui/image-picker";
import { IconAlert, IconCheck, IconStorefront } from "@/components/ui/icons";

/** The server enforces the same ceiling; check it here so big files never round-trip. */
const STORE_IMAGE_MAX_BYTES = 300_000;

/**
 * Seller-owned store identity: logo, name, city, bio. Handle is admin-fixed and
 * rendered read-only; everything else saves through `updateSellerProfile`.
 */
export function StoreProfileForm({
  storeName: initialName,
  city: initialCity,
  bio: initialBio,
  storeImage: initialImage,
  handle,
  disabled,
}: {
  storeName: string;
  city: string;
  bio: string;
  storeImage: string | null;
  handle: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [city, setCity] = useState(initialCity);
  const [bio, setBio] = useState(initialBio);
  const [image, setImage] = useState<string | null>(initialImage);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    name.trim() !== initialName ||
    city.trim() !== initialCity ||
    bio.trim() !== initialBio ||
    image !== initialImage;

  function save() {
    setError(null);
    setSaved(false);
    const trimmedName = name.trim();
    const trimmedCity = city.trim();
    if (trimmedName.length < 3 || trimmedName.length > 60) {
      setError("Nama toko harus 3-60 karakter.");
      return;
    }
    if (trimmedCity.length < 2 || trimmedCity.length > 60) {
      setError("Kota harus 2-60 karakter.");
      return;
    }
    startTransition(async () => {
      const result = await updateSellerProfile({
        storeName: trimmedName,
        city: trimmedCity,
        bio: bio.trim(),
        storeImage: image,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const previewName = name.trim() || initialName;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <SellerAvatar name={previewName} size={56} imageUrl={image} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-bold text-ink">{previewName}</span>
          <span className="text-[11px] text-ink-mute">
            @{handle} — pratinjau logo &amp; nama di katalog
          </span>
        </div>
      </div>

      <ImagePicker
        value={image}
        onChange={(next) => {
          setImage(next);
          setSaved(false);
        }}
        label="Logo toko"
        pickTitle="Pilih logo toko"
        hint="PNG/JPG/GIF/WebP, maksimal 300KB. Kosongkan untuk pakai inisial nama toko."
        maxBytes={STORE_IMAGE_MAX_BYTES}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Nama toko"
          htmlFor="store-name"
          hint="3-60 karakter. Tampil di katalog, halaman produk, dan ruang pesanan."
        >
          <TextInput
            id="store-name"
            value={name}
            maxLength={60}
            disabled={disabled}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <Field label="Kota" htmlFor="store-city" hint="2-60 karakter, tampil di kartu penjual.">
          <TextInput
            id="store-city"
            value={city}
            maxLength={60}
            disabled={disabled}
            onChange={(event) => {
              setCity(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
      </div>

      <Field
        label="Bio singkat"
        htmlFor="store-bio"
        hint={`${bio.length}/280 karakter. Ceritakan kecepatan layanan atau jam operasional tokomu.`}
      >
        <TextArea
          id="store-bio"
          value={bio}
          maxLength={280}
          rows={3}
          disabled={disabled}
          onChange={(event) => {
            setBio(event.target.value);
            setSaved(false);
          }}
        />
      </Field>

      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />}>
          {error}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={disabled || isPending || !dirty}
          onClick={save}
        >
          <IconStorefront size={15} />
          {isPending ? "Menyimpan..." : "Simpan profil toko"}
        </Button>
        {saved && !dirty ? (
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-success">
            <IconCheck size={14} />
            Profil toko tersimpan
          </span>
        ) : null}
      </div>
    </div>
  );
}
