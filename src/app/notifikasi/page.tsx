import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Skeleton, EmptyState } from "@/components/ui/feedback";
import { MarkReadButton } from "@/components/site/mark-read-button";
import { IconBell } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Notifikasi",
  description: "Kotak masuk aktivitas akun Blox Astra — pembayaran, pesanan, sengketa, dan penarikan.",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-28 md:px-8 md:pt-36">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-24 w-full rounded-3xl" />
          <Skeleton className="mt-3 h-24 w-full rounded-3xl" />
        </div>
      }
    >
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  await connection();
  const user = await requireUser();
  const items = await getNotifications(user.id);
  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-28 md:px-8 md:pt-36">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-[13px] text-ink-mute">
              <IconBell size={16} className="text-astra-ink" />
              Kotak masuk
            </span>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-[2.1rem]">
              Notifikasi
            </h1>
            <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
              {unread > 0
                ? `${unread} belum dibaca — pembayaran, progres pesanan, sengketa, dan penarikan.`
                : "Semua sudah dibaca. Aktivitas baru soal pembayaran, pesanan, dan dompet masuk ke sini."}
            </p>
          </div>
          <MarkReadButton disabled={unread === 0} />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={<IconBell size={22} />}
            title="Belum ada notifikasi"
            description="Mulai belanja atau jualan — setiap pergerakan dana dan status pesanan tercatat di sini."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((item) => {
              const inner = (
                <>
                  <span
                    className={cx(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      item.read ? "bg-line" : "bg-astra",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[13px] font-bold text-ink">{item.title}</span>
                    {item.body ? (
                      <span className="text-[12px] leading-relaxed text-ink-dim">{item.body}</span>
                    ) : null}
                    <span className="num text-[10px] text-ink-mute">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </span>
                </>
              );
              const cardClass =
                "flex items-start gap-3 rounded-[1.4rem] bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line transition-colors duration-200 hover:bg-canvas";
              return item.link ? (
                <Link key={item.id} href={item.link} className={cardClass}>
                  {inner}
                </Link>
              ) : (
                <div key={item.id} className={cardClass}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
