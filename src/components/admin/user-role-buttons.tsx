"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeUserRole } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { IconRefresh } from "@/components/ui/icons";

/**
 * Per-row role switch for the admin user lists (pengguna tab + pencarian).
 * Seller ↔ buyer only; admin accounts stay out-of-band (no button).
 * Suspended accounts keep the button disabled — the server refuses the
 * switch until the suspension is lifted.
 */
export function UserRoleButtons({
  userId,
  username,
  role,
  suspended,
}: {
  userId: string;
  username: string;
  role: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (role === "admin") return null;

  const target = role === "seller" ? "buyer" : "seller";
  const label = target === "seller" ? "Jadikan penjual" : "Jadikan pembeli";

  async function handleSwitch() {
    const confirmText =
      target === "seller"
        ? `Jadikan ${username} penjual (terverifikasi)? Toko langsung aktif.`
        : `Jadikan ${username} pembeli? Toko offline, riwayat tetap tersimpan.`;
    if (!window.confirm(confirmText)) return;
    setPending(true);
    setError(null);
    const result = await changeUserRole({ userId, role: target });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<IconRefresh size={15} />}
        disabled={pending || suspended}
        title={suspended ? "Pulihkan dulu akun sebelum ubah peran" : label}
        onClick={() => void handleSwitch()}
      >
        {pending ? "…" : label}
      </Button>
      {error ? <span className="text-[11px] font-bold text-danger">{error}</span> : null}
    </span>
  );
}
