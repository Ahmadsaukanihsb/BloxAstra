"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { IconCheck } from "@/components/ui/icons";

export function MarkReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function mark() {
    setError(false);
    startTransition(async () => {
      try {
        await markNotificationsRead();
        router.refresh();
      } catch {
        setError(true);
      }
    });
  }

  return (
    <span className="flex flex-col items-end gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<IconCheck size={14} />}
        disabled={disabled || isPending}
        onClick={mark}
      >
        {isPending ? "Menandai…" : "Tandai semua dibaca"}
      </Button>
      {error ? (
        <span className="text-[11px] font-bold text-danger">
          Gagal menandai — sesi berakhir, muat ulang halaman.
        </span>
      ) : null}
    </span>
  );
}
