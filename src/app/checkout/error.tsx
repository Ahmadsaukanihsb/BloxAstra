"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { IconAlert, IconCompass, IconRefresh } from "@/components/ui/icons";

export default function CheckoutError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-5 px-4 py-24 text-center md:py-32">
      <span className="grid size-14 place-items-center rounded-2xl bg-danger/12 text-danger">
        <IconAlert size={26} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-ink">
          Checkout gagal dimuat
        </h1>
        <p className="text-sm leading-relaxed text-ink-mute">
          Detail produk atau kalkulasi harga tidak bisa diambil. Dana belum ditahan — aman untuk
          coba lagi atau kembali ke katalog.
        </p>
      </div>
      {error.digest ? (
        <p className="num text-[11px] font-bold text-ink-mute">Kode: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button onClick={retry} leadingIcon={<IconRefresh size={16} />}>
          Coba lagi
        </Button>
        <ButtonLink href="/katalog" variant="secondary" leadingIcon={<IconCompass size={16} />}>
          Kembali ke katalog
        </ButtonLink>
      </div>
    </div>
  );
}
