"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { suspendUser, unsuspendUser } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { IconAlert, IconLock } from "@/components/ui/icons";

/**
 * Per-row suspend controls for the admin user search. Suspended accounts are
 * locked out on next read; unsuspend restores access immediately.
 */
export function UserSuspendButtons({
  userId,
  username,
  role,
  suspended,
  suspendReason,
}: {
  userId: string;
  username: string;
  role: string;
  suspended: boolean;
  suspendReason: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "form">("idle");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin accounts are only manageable out-of-band — no button is rendered.
  if (role === "admin") return null;

  async function handleSuspend() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Alasan minimal 3 karakter.");
      return;
    }
    if (!window.confirm(`Tangguhkan ${username}? Akun langsung terkunci.`)) return;
    setPending(true);
    setError(null);
    const result = await suspendUser({ userId, reason: trimmed });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("idle");
    setReason("");
    router.refresh();
  }

  async function handleUnsuspend() {
    setPending(true);
    setError(null);
    const result = await unsuspendUser({ userId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (suspended) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Badge tone="danger" icon={<IconLock size={13} />}>
          Ditangguhkan{suspendReason ? `: ${suspendReason}` : ""}
        </Badge>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => void handleUnsuspend()}>
          {pending ? "…" : "Pulihkan"}
        </Button>
        {error ? <span className="text-[11px] font-bold text-danger">{error}</span> : null}
      </span>
    );
  }

  if (mode === "form") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Field label="Alasan penangguhan" htmlFor={`suspend-${userId}`}>
          <TextInput
            id={`suspend-${userId}`}
            value={reason}
            placeholder="Mis. terbukti menipu di luar platform"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Button
          variant="danger"
          size="sm"
          leadingIcon={<IconAlert size={15} />}
          disabled={pending || reason.trim().length < 3}
          onClick={() => void handleSuspend()}
        >
          {pending ? "…" : "Tangguhkan"}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setMode("idle")}>
          Batal
        </Button>
        {error ? <span className="text-[11px] font-bold text-danger">{error}</span> : null}
      </span>
    );
  }

  return (
    <Button variant="ghost" size="sm" leadingIcon={<IconLock size={15} />} onClick={() => setMode("form")}>
      Tangguhkan
    </Button>
  );
}
