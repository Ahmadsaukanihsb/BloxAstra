"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { activateAdminSeller } from "@/app/actions/seller";

export function AdminSellerActivator() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function activate() {
    setError(null);
    startTransition(async () => {
      const result = await activateAdminSeller();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    // items-start keeps the action at label width instead of stretching the
    // button across the whole card.
    <div className="flex flex-col items-start gap-2">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button onClick={activate} disabled={isPending}>
        {isPending ? "Mengaktifkan…" : "Aktifkan akun penjual"}
      </Button>
    </div>
  );
}
