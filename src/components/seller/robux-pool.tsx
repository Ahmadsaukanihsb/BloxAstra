"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startOrderProcessing } from "@/app/actions/room";
import { useLiveStream } from "@/lib/live";
import { formatDateTime, formatIDR, formatNumber } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Countdown } from "@/components/order/runtime";
import type { RobuxPoolItem } from "@/lib/orders";
import {
  IconAlert,
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconHexCoin,
  IconRefresh,
  IconShieldCheck,
  IconTimer,
  IconUsers,
} from "@/components/ui/icons";

const KIND_TONE: Record<string, "astra" | "robux" | "warn" | "info"> = {
  robux_username: "robux",
  robux_login: "warn",
  robux_gamepass: "astra",
  premium: "info",
};

export function RobuxPoolBoard({
  orders: initialOrders,
  canClaim,
  locked,
}: {
  orders: RobuxPoolItem[];
  canClaim: boolean;
  locked?: boolean;
}) {
  const router = useRouter();
  // Codes this seller already claimed/took — never resurrect them on sync.
  // Held as state (not a ref) so the visible board is a pure derivation: the
  // server props minus what this tab already acted on. Nothing has to sync in
  // an effect, and a ref is never read during render.
  const [gone, setGone] = useState<string[]>([]);
  const orders = useMemo(
    () => initialOrders.filter((item) => !gone.includes(item.code)),
    [initialOrders, gone],
  );
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  function forget(code: string) {
    setGone((prev) => (prev.includes(code) ? prev : [...prev, code]));
  }

  // Push channel: a new pool order or another seller's claim lands here the
  // second it happens; the 25s poll below stays as the blocked-stream net.
  useLiveStream(["pool"], () => router.refresh());

  // Rebutan needs fresh data — poll quietly; countdowns keep ticking locally.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 25_000);
    return () => window.clearInterval(id);
  }, [router]);

  async function handleClaim(order: RobuxPoolItem) {
    setClaiming(order.code);
    setError(null);
    const result = await startOrderProcessing(order.code);
    setClaiming(null);
    if (!result.ok) {
      setError(result.error);
      if (result.code === "STATE") {
        forget(order.code);
      }
      return;
    }
    forget(order.code);
    setFlash(`Berhasil mengambil ${order.code}. Mengalihkan ke ruang pesanan...`);
    // Straight into the room: claiming is only half the job, hand-over happens there.
    router.push(`/pesanan/${order.code}`);
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {flash ? (
          <Notice tone="astra" icon={<IconCheck size={15} />} title="Rebutan berhasil">
            {flash}
          </Notice>
        ) : null}
        <EmptyState
          icon={<IconHexCoin size={22} />}
          title="Pool sedang kosong"
          description="Belum ada order Robux baru menunggu diambil. Order Robux (Username/Login/Gamepass/Premium) dari pembeli akan langsung masuk ke sini begitu dibayar. Rebut secepat mungkin sebelum penjual lain mengambilnya."
          action={
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<IconRefresh size={15} />}
              onClick={() => router.refresh()}
            >
              Muat ulang pool
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {locked ? (
        <Notice tone="warn" icon={<IconShieldCheck size={15} />} title="Rebutan dikunci: KYC belum disetujui">
          Tombol ambil aktif lagi otomatis setelah admin menyetujui identitasmu. Mengklik
          sekarang pun ditolak server.
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal mengambil">
          {error}
        </Notice>
      ) : null}
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Rebutan berhasil">
          {flash}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone="robux" icon={<IconUsers size={13} />}>
          {orders.length} order menunggu diambil
        </Badge>
        <span className="text-[11px] text-ink-mute">
          Yang pertama mengklik &quot;Ambil order&quot; yang mendapatkannya. Penjual lain otomatis kalah.
          Pool muncul dan hilang langsung tanpa muat ulang.
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {orders.map((order) => (
          <article
            key={order.id}
            className="flex flex-col gap-4 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line md:p-5"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone={KIND_TONE[order.kind] ?? "astra"} icon={<IconHexCoin size={13} />}>
                {order.kindLabel}
              </Badge>
              {order.expressBadge ? (
                <Badge tone="astra" icon={<IconBolt size={12} />}>
                  Kilat 10 Menit
                </Badge>
              ) : null}
              <span className="num text-[11px] text-ink-mute">{order.code}</span>
              <span className="num ml-auto text-[11px] text-ink-mute">
                masuk {formatDateTime(order.createdAt)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="num text-[19px] font-extrabold text-astra-ink">
                  {order.robuxAmount ? `${formatNumber(order.robuxAmount)} Robux` : "Roblox Premium"}
                </span>
                {order.robloxUsername ? (
                  <span className="text-[12px] text-ink-dim">
                    tujuan <span className="num font-bold text-ink">@{order.robloxUsername}</span>
                  </span>
                ) : null}
                <span className="num text-[12px] text-ink-dim">{formatIDR(order.total)}</span>
              </div>

              <div className="flex flex-col items-end gap-2.5">
                {order.claimable ? (
                <Countdown
                  seconds={order.claimSecondsLeft}
                  className="text-[11px]"
                />
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-warn">
                  <IconTimer size={13} />
                  lewat jendela — segera di-refund
                </span>
              )}
                <div className="flex flex-wrap justify-end gap-2.5">
                  <Button
                    size="sm"
                    leadingIcon={<IconCheck size={15} />}
                    disabled={claiming !== null || !canClaim || locked}
                    onClick={() => void handleClaim(order)}
                  >
                    {claiming === order.code ? "Mengambil…" : "Ambil order"}
                  </Button>
                  <Link
                    href={`/pesanan/${order.code}`}
                    className={cx(
                      "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold",
                      "text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-200 hover:bg-canvas-2 hover:text-ink",
                    )}
                  >
                    Detail
                    <IconArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
