"use client";

import { RecordFrame } from "@/components/admin/console";
import { UserRoleButtons } from "@/components/admin/user-role-buttons";
import { UserSuspendButtons } from "@/components/admin/user-suspend-buttons";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { AdminUserRow } from "@/lib/admin";
import { IconAlert, IconCheck, IconSearch, IconUsers } from "@/components/ui/icons";

const ROLE_TONE: Record<string, "astra" | "robux" | "neutral"> = {
  admin: "astra",
  seller: "robux",
  buyer: "neutral",
};

/**
 * Account moderation queue: newest accounts with suspended ones pinned on
 * top, each row carrying its own suspend / unsuspend control. Anything
 * older lives in the admin search (linked below).
 */
export function UsersPanel({
  initial,
  suspendedCount,
}: {
  initial: AdminUserRow[];
  suspendedCount: number;
}) {
  if (initial.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers size={22} />}
        title="Belum ada pengguna"
        description="Akun yang mendaftar muncul di sini untuk dimoderasi."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {suspendedCount > initial.filter((row) => row.suspended).length ? (
        <Notice tone="warn" icon={<IconAlert size={15} />} title="Tidak semua yang ditangguhkan tampil">
          {suspendedCount} akun sedang ditangguhkan; daftar ini hanya membawa 20 akun terbaru.
          Cari sisanya lewat pencarian admin.
        </Notice>
      ) : null}
      {initial.map((row) => (
        <RecordFrame key={row.id} tone={row.suspended ? "danger" : "neutral"}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={ROLE_TONE[row.role] ?? "neutral"}>{row.role}</Badge>
            <span className="text-[13px] font-extrabold text-ink">{row.username}</span>
            <span className="min-w-[140px] flex-1 truncate text-[12px] text-ink-dim">{row.email}</span>
            <span className="num text-[11px] text-ink-mute">
              {row.storeName ?? "tanpa toko"} · {formatNumber(row.orderCount)} pesanan ·{" "}
              {formatDateTime(row.joinedAt)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-3">
            <UserRoleButtons
              userId={row.id}
              username={row.username}
              role={row.role}
              suspended={row.suspended}
            />
            <UserSuspendButtons
              userId={row.id}
              username={row.username}
              role={row.role}
              suspended={row.suspended}
              suspendReason={row.suspendReason}
            />
            {row.suspended && row.suspendReason ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-mute">
                <IconCheck size={13} className="text-danger" />
                Alasan tercatat di log audit
              </span>
            ) : null}
          </div>
        </RecordFrame>
      ))}
      <ButtonLink href="/admin/cari?jenis=pengguna" variant="secondary" size="sm" className="w-fit" leadingIcon={<IconSearch size={14} />}>
        Cari pengguna lain
      </ButtonLink>
    </div>
  );
}
