"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationsRead,
} from "@/app/actions/notifications";
import type { NotificationItem } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import { cx } from "@/lib/cx";
import { IconBell, IconCheck } from "@/components/ui/icons";

/**
 * Bell with a floating inbox panel — sellers read notifications without
 * leaving the dashboard. The /notifikasi page stays as the full archive
 * (linked from the panel footer + sidebar).
 */
export function NotifBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [marking, startMarking] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const count = await fetchUnreadCount();
        if (alive) setUnread(count);
      } catch {
        /* offline — badge stays hidden */
      }
    }
    void load();
    const id = window.setInterval(load, 60_000);
    function onFocus() {
      void load();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  async function loadItems() {
    setLoading(true);
    try {
      const result = await fetchNotifications();
      setItems(result.items);
      setUnread(result.unread);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open) void loadItems();
    setOpen((value) => !value);
  }

  function markAll() {
    startMarking(async () => {
      try {
        await markNotificationsRead();
        setItems((prev) => prev?.map((item) => ({ ...item, read: true })) ?? prev);
        setUnread(0);
      } catch {
        /* keep badge; user can retry */
      }
    });
  }

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread > 0 ? `${unread} notifikasi belum dibaca` : "Notifikasi"}
        className={cx(
          "relative grid size-9 place-items-center rounded-full transition-colors duration-200 hover:bg-canvas",
          open ? "bg-canvas text-ink" : "text-ink-dim hover:text-ink",
        )}
      >
        <IconBell size={19} />
        {unread > 0 ? (
          <span className="num absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-extrabold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            role="dialog"
            aria-label="Notifikasi terbaru"
            className="absolute right-0 top-[calc(100%+10px)] z-50 flex max-h-[min(70vh,480px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-card bg-paper shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)] outline outline-1 -outline-offset-1 outline-line"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <span className="text-[13px] font-extrabold text-ink">
                Notifikasi
                {unread > 0 ? (
                  <span className="num ml-1.5 rounded-full bg-astra/10 px-2 py-0.5 text-[10px] text-astra-ink">
                    {unread} baru
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={markAll}
                disabled={marking || unread === 0}
                className="flex items-center gap-1 text-[11px] font-bold text-ink-dim transition-colors hover:text-astra-ink disabled:opacity-40"
              >
                <IconCheck size={13} />
                {marking ? "Menandai…" : "Tandai dibaca"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading || items === null ? (
                <div className="flex flex-col gap-2 p-2">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="h-16 animate-pulse rounded-well bg-canvas"
                    />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <IconBell size={22} className="text-ink-mute" />
                  <p className="text-[13px] font-bold text-ink">Belum ada notifikasi</p>
                  <p className="max-w-[30ch] text-[12px] leading-relaxed text-ink-mute">
                    Pergerakan dana dan status pesanan akan muncul di sini.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const inner = (
                    <>
                      <span
                        className={cx(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          item.read ? "bg-line" : "bg-astra",
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[13px] font-bold leading-snug text-ink">
                          {item.title}
                        </span>
                        {item.body ? (
                          <span className="line-clamp-2 text-[12px] leading-relaxed text-ink-dim">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="num text-[10px] text-ink-mute">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </span>
                    </>
                  );
                  const cardClass =
                    "flex items-start gap-3 rounded-well p-3 transition-colors duration-200 hover:bg-canvas";
                  return item.link ? (
                    <Link
                      key={item.id}
                      href={item.link}
                      onClick={() => setOpen(false)}
                      className={cardClass}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={item.id} className={cardClass}>
                      {inner}
                    </div>
                  );
                })
              )}
            </div>

            <Link
              href="/notifikasi"
              onClick={() => setOpen(false)}
              className="border-t border-line px-4 py-2.5 text-center text-[12px] font-bold text-astra-ink transition-colors hover:bg-canvas"
            >
              Lihat semua
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
