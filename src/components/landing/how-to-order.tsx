import { cx } from "@/lib/cx";
import { CREDENTIAL_WIPE_DAYS } from "@/lib/sweep";
import { ESCROW_WINDOWS } from "@/lib/legal";
import { howToOrder } from "@/lib/how-to-order";
import { SectionHeading } from "@/components/ui/surface";
import { Reveal } from "@/components/ui/reveal";
import { IconInfo } from "@/components/ui/icons";

/**
 * The band that answers "kok aman?" — the question the hero raises the moment
 * it prints a price and a pay button.
 *
 * It sits directly under the hero on purpose. Everything else on this page can
 * be absent on a quiet day (the shelves are built from the catalog), but the
 * process is always true, and it is the only thing that can carry a first-time
 * visitor from a price to a payment. A greyed-out "0 stok" reads as a dead
 * shop; three concrete steps read as a working one.
 *
 * Every number on this band is imported, never typed: the refund windows and
 * the dispute SLA come from `ESCROW_WINDOWS` (which reads `DEFAULT_TIMEOUTS`
 * from the sweep job that enforces them), and the credential window is the same
 * constant the wipe job uses. That is also why the copy itself lives in
 * `lib/how-to-order.ts` as data — see the note there.
 *
 * A server component: no state, no motion beyond the page's standard reveal.
 */
export function HowToOrder() {
  const { steps, doubts } = howToOrder({
    ...ESCROW_WINDOWS,
    credentialWipeDays: CREDENTIAL_WIPE_DAYS,
  });

  return (
    <section className="px-4 pb-4 pt-12 md:px-8 md:pb-6 md:pt-16">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <Reveal>
          <SectionHeading
            title="Cara pesan"
            description="Uangmu tidak pernah langsung ke penjual. Tiga langkah ini berlaku untuk semua metode — yang berbeda hanya cara barangnya diserahkan."
          />
        </Reveal>

        {/* One band holding three cells rather than three floating cards:
            hairlines between the steps are what make it read as one process
            instead of three unrelated offers. The vertical stack keeps its
            order on a phone, and the sequence markers carry the flow there. */}
        <Reveal delay={0.05}>
          <ol className="grid grid-cols-1 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper md:grid-cols-3 md:divide-x md:divide-y-0">
            {steps.map((step, index) => (
              <li key={step.no} className="flex flex-col gap-3 p-5 md:p-6">
                <span className="flex items-center gap-3">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-control bg-canvas-2 text-[11px] font-extrabold text-astra-ink outline outline-1 -outline-offset-1 outline-line">
                    {step.no}
                  </span>
                  {/* A hairline leaving each marker: the step points at the one
                      after it, so three cells read as a route. */}
                  <span aria-hidden className="h-px flex-1 bg-line" />
                </span>

                <h3 className="text-[14px] font-extrabold leading-snug text-ink">{step.title}</h3>
                <p className="text-[12.5px] leading-relaxed text-ink-dim">{step.body}</p>

                {/* The one detail worth pulling out of the body. The middle step
                    is the one about money, so it is the one that gets gold —
                    gold means value everywhere else in this app. */}
                <span
                  className={cx(
                    "mt-auto border-t border-line pt-3 text-[11px] font-bold",
                    index === 1 ? "text-gold" : "text-ink-mute",
                  )}
                >
                  {step.fact}
                </span>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* The three doubts that stop a first-time buyer, answered with the
            mechanism instead of with reassurance. A definition list because
            that is what the pairs are — question and answer, not features. */}
        <Reveal delay={0.08}>
          <div className="flex flex-col gap-4">
            <h3 className="text-[13px] font-extrabold text-ink">
              Yang paling sering ditanyakan sebelum bayar
            </h3>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
              {doubts.map((doubt) => (
                <div key={doubt.q} className="flex flex-col gap-1.5">
                  <dt className="flex items-start gap-2 text-[12px] font-extrabold text-ink">
                    <IconInfo size={14} className="mt-px shrink-0 text-astra-ink" />
                    {doubt.q}
                  </dt>
                  <dd className="text-[11.5px] leading-relaxed text-ink-dim">{doubt.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
