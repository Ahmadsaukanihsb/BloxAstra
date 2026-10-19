"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format";
import { cx } from "@/lib/cx";
import { LivePill } from "@/components/ui/badge";
import { orderStates } from "@/lib/order-meta";
import type { OrderState } from "@/lib/types";

/** Ticking SLA clock. Starts from a duration so server HTML and client agree. */
export function Countdown({
  seconds,
  className,
  onExpire,
}: {
  seconds: number;
  className?: string;
  onExpire?: () => void;
}) {
  const [left, setLeft] = useState(Math.max(0, Math.floor(seconds)));
  const [lastSeconds, setLastSeconds] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  const expired = left <= 0;

  // Re-sync when the caller hands us a new duration (render-phase adjustment).
  if (lastSeconds !== seconds) {
    setLastSeconds(seconds);
    setLeft(Math.max(0, Math.floor(seconds)));
  }

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (expired) return;
    const id = window.setInterval(() => {
      setLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expired]);

  // Fired from an effect, never from inside a setState updater.
  useEffect(() => {
    if (expired) onExpireRef.current?.();
  }, [expired]);

  const urgent = !expired && left <= 120;

  return (
    <span
      className={cx(
        "num inline-flex items-center gap-2 tabular-nums",
        expired || urgent ? "text-danger" : "text-robux",
        className,
      )}
      suppressHydrationWarning
    >
      <span className="relative grid size-2 place-items-center">
        <span
          className={cx(
            "absolute size-2 rounded-full opacity-60",
            expired || urgent ? "bg-danger" : "bg-robux",
          )}
          style={{ animation: "breathe 2.4s ease-in-out infinite" }}
        />
        <span
          className={cx(
            "size-1 rounded-full",
            expired || urgent ? "bg-danger" : "bg-robux",
          )}
        />
      </span>
      {formatClock(left)}
    </span>
  );
}

const PILL_TONE: Record<OrderState, "astra" | "neutral" | "warn" | "danger" | "robux"> = {
  pending_payment: "warn",
  paid: "astra",
  processing: "astra",
  shipped: "robux",
  completed: "astra",
  disputed: "danger",
  refunded: "neutral",
  cancelled: "neutral",
};

export function StatusPill({ state, className }: { state: OrderState; className?: string }) {
  return (
    <LivePill
      label={orderStates[state].label}
      tone={PILL_TONE[state]}
      className={className}
    />
  );
}
