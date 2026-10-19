"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchInboxRevision, fetchNotifications } from "@/app/actions/notifications";
import { useLiveRevision, useLiveStream } from "@/lib/live";
import type { NotificationItem } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import { cx } from "@/lib/cx";
import type { ReactNode } from "react";
import {
  IconAlert,
  IconBank,
  IconBell,
  IconBolt,
  IconChat,
  IconCheckCircle,
  IconFlag,
  IconHexCoin,
  IconPackage,
  IconReceipt,
  IconRefresh,
  IconScanFace,
  IconSealCheck,
  IconSparkle,
  IconStar,
  IconTimer,
  IconWallet,
  IconX,
} from "@/components/ui/icons";

/** Toast lifetime before it slides away on its own. */
const TOAST_TTL_MS = 8500;
/** Newest N stacked; older ones drop off instead of covering the page. */
const TOAST_LIMIT = 4;

type ToastTone = "astra" | "success" | "danger";

const DANGER_KINDS = new Set(["order_cancelled", "dispute_opened", "chat_report", "kyc_rejected"]);
const SUCCESS_KINDS = new Set([
  "order_completed",
  "dispute_resolved",
  "withdrawal_decided",
  "kyc_approved",
]);

type ToastIcon = (props: { size?: number }) => ReactNode;

const ICON_BY_KIND: Record<string, ToastIcon> = {
  order_paid: IconReceipt,
  topup_paid: IconReceipt,
  order_processing: IconPackage,
  order_shipped: IconBolt,
  order_completed: IconCheckCircle,
  order_refunded: IconRefresh,
  pool_refunded: IconHexCoin,
  order_cancelled: IconX,
  order_reminder: IconTimer,
  dispute_opened: IconAlert,
  dispute_resolved: IconSealCheck,
  chat_report: IconFlag,
  chat_message: IconChat,
  withdrawal_submitted: IconBank,
  withdrawal_decided: IconWallet,
  review_received: IconStar,
  kyc_submitted: IconScanFace,
  kyc_approved: IconSealCheck,
  kyc_rejected: IconAlert,
  role_changed: IconSparkle,
};

/** Module-level helper: picking an icon per toast must not create a component
 *  inside render (react-hooks/static-components), so the element is built here. */
function renderToastIcon(kind: string, size = 16): ReactNode {
  const Icon = ICON_BY_KIND[kind] ?? IconBell;
  return <Icon size={size} />;
}

function toastTone(kind: string): ToastTone {
  if (DANGER_KINDS.has(kind)) return "danger";
  if (SUCCESS_KINDS.has(kind)) return "success";
  return "astra";
}

const TONE_STYLES: Record<ToastTone, string> = {
  astra: "bg-astra/10 text-astra-ink",
  success: "bg-success/15 text-success",
  danger: "bg-danger/10 text-danger",
};

interface ToastCardProps {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), TOAST_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  function open() {
    onDismiss(item.id);
    router.push(item.link ?? "/notifikasi");
  }

  return (
    <div className="pointer-events-auto relative w-[min(88vw,360px)] animate-rise">
      <button
        type="button"
        onClick={open}
        className="bezel-shell block w-full p-1 text-left transition-transform duration-300 ease-[var(--ease-astra)] hover:-translate-y-0.5"
      >
        <span className="bezel-core flex w-full items-start gap-3 p-3.5 pr-8">
          <span
            className={cx(
              "mt-0.5 grid size-8 shrink-0 place-items-center rounded-control",
              TONE_STYLES[toastTone(item.kind)],
            )}
          >
            {renderToastIcon(item.kind)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[12.5px] font-bold leading-snug text-ink">{item.title}</span>
            {item.body ? (
              <span className="line-clamp-2 text-[11px] leading-relaxed text-ink-dim">
                {item.body}
              </span>
            ) : null}
            <span className="num text-[10px] text-ink-mute">{formatDateTime(item.createdAt)}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => onDismiss(item.id)}
        className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-ink-mute transition-colors duration-200 hover:bg-canvas hover:text-ink"
      >
        <IconX size={12} />
      </button>
    </div>
  );
}

/**
 * Live toast stack, bottom-right. Mounted once in the root layout for signed-in
 * users: it listens on the shared inbox stream and pops a card the moment a new
 * notification lands, so the visitor sees order/chat movement without watching
 * the bell.
 *
 * The first fetch only primes the seen-set — whatever was already unread on
 * page load is the bell's job, not a wall of toasts on every navigation.
 */
export function LiveToaster() {
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const inFlightRef = useRef(false);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const poll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const { items } = await fetchNotifications();
      if (!primedRef.current) {
        primedRef.current = true;
        for (const item of items) seenRef.current.add(item.id);
        return;
      }
      const fresh = items.filter((item) => !seenRef.current.has(item.id));
      for (const item of items) seenRef.current.add(item.id);
      if (fresh.length === 0) return;
      setToasts((prev) => {
        const merged = [...fresh, ...prev];
        const unique = merged.filter(
          (toast, index) => merged.findIndex((entry) => entry.id === toast.id) === index,
        );
        return unique.slice(0, TOAST_LIMIT);
      });
    } catch {
      // Signed out mid-session or a transient blip: stay quiet and retry.
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Push first: a new notification reaches this tab in well under a second.
  useLiveStream(["inbox"], () => {
    void poll();
  });

  // Fallback for a blocked stream, and the catch-up sweep when the tab wakes.
  useLiveRevision({
    read: fetchInboxRevision,
    intervalMs: 60_000,
    onChange: () => void poll(),
  });

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-20 z-50 flex flex-col items-end gap-2 md:inset-x-auto md:bottom-5 md:right-5"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} item={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
