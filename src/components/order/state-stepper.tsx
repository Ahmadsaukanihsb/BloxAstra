import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/format";
import { orderStates } from "@/lib/order-meta";
import type { OrderState } from "@/lib/types";
import type { OrderTimelineEntry } from "@/lib/orders";
import { IconCheck } from "@/components/ui/icons";

const FLOW = [
  "pending_payment",
  "open_pool",
  "paid",
  "processing",
  "shipped",
  "completed",
] as const;

type FlowState = (typeof FLOW)[number];

/**
 * Mirrors the PRD order state machine as a horizontal progress rail.
 *
 * The rail is driven by which flow states actually carry a timestamp in the
 * order timeline, so terminal states stop where the order really got to
 * instead of pretending every step ran (disputed/refunded) or none did
 * (cancelled).
 */
export function StateStepper({
  state,
  timeline,
}: {
  state: OrderState;
  timeline: OrderTimelineEntry[];
}) {
  const reached = timeline.reduce((furthest, entry) => {
    const index = FLOW.indexOf(entry.state as FlowState);
    return entry.at && index > furthest ? index : furthest;
  }, 0);
  const terminal = state === "disputed" || state === "refunded" || state === "cancelled";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-6 gap-1.5">
        {FLOW.map((flowState, index) => {
          const done = terminal ? index <= reached : index < reached;
          const active = !terminal && index === reached;
          const reachedStep = done || active;
          return (
            <div key={flowState} className="flex flex-col gap-2">
              <span
                className={cx(
                  "h-1.5 w-full rounded-full transition-colors duration-500",
                  reachedStep ? (active ? "bg-astra" : "bg-astra/45") : "bg-canvas",
                )}
              />
              <span
                className={cx(
                  "text-[10px] leading-tight",
                  active ? "text-astra-ink" : reachedStep ? "text-ink-dim" : "text-ink-mute",
                )}
              >
                {orderStates[flowState].label}
              </span>
            </div>
          );
        })}
      </div>

      {terminal ? (
        <p className="text-[11px] text-ink-mute">
          Alur berhenti di status <span className="text-ink-dim">{orderStates[state].label}</span> —
          dana {state === "refunded" ? "dikembalikan ke pembeli" : state === "disputed" ? "dibekukan" : "dibatalkan"}.
        </p>
      ) : null}

      <ol className="flex flex-col divide-y divide-hairline border-t border-hairline">
        {timeline.map((entry, index) => (
          <li key={`${entry.state}-${index}`} className="flex gap-3.5 py-3.5">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-astra/12 text-astra-ink outline outline-1 -outline-offset-1 outline-astra/25">
              <IconCheck size={12} />
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold text-ink">{entry.label}</span>
                <span className="num text-[11px] text-ink-mute">{formatDateTime(entry.at)}</span>
              </div>
              {entry.note ? (
                <p className="text-[11px] leading-relaxed text-ink-mute">{entry.note}</p>
              ) : null}
              {entry.actor ? (
                <span className="w-fit rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  {entry.actor}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
