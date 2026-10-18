"use client";

import { useMemo, useState } from "react";
import { formatIDR } from "@/lib/format";
import {
  clampRobuxAmount,
  robuxOrderConfig,
  robuxOrderHref,
  robuxOrderPrice,
  type RobuxOrderKind,
} from "@/lib/robux-orders";
import { useRateStore } from "@/components/rates/rate-store";
import { LivePill } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { cx } from "@/lib/cx";
import { IconArrowRight, IconBolt, IconHexCoin, IconShieldCheck } from "@/components/ui/icons";

const METHODS: { kind: RobuxOrderKind; label: string; hint: string }[] = [
  { kind: "username", label: "Username", hint: "Langsung masuk" },
  { kind: "login", label: "Login", hint: "Proses kilat" },
  { kind: "gamepass", label: "Gamepass", hint: "Paling hemat" },
];

const TRUST = [
  { icon: IconShieldCheck, label: "Dana ditahan escrow" },
  { icon: IconBolt, label: "Penjual terverifikasi KYC" },
  { icon: IconHexCoin, label: "Garansi kembali 100%" },
];

/**
 * The lobby. One dark band carrying the offer, with the buy flow as a counter
 * recessed into it.
 *
 * The headline is a single colour on purpose: accenting one phrase of a
 * headline in red, with a hand-drawn underline under it, is the most common
 * generated-hero tell there is. Scale and weight carry the emphasis instead,
 * and the one piece of colour in this section belongs to the money — the total
 * figure is gold, because gold means value everywhere in this app.
 */
export function Hero() {
  const { rates } = useRateStore();
  const [method, setMethod] = useState<RobuxOrderKind>("username");
  const [nominal, setNominal] = useState<number | null>(null);

  const config = useMemo(() => robuxOrderConfig(method, rates.orders), [method, rates]);
  const amount = nominal ?? config.initialRobux;
  const total = robuxOrderPrice(config, amount);

  // The nominal rides along in the link, so "lanjut beli" opens the order page
  // already filled in with the number dialled here instead of its own default.
  const checkoutHref = robuxOrderHref(config, amount);

  return (
    <section className="relative px-4 pt-4 md:px-8 md:pt-6">
      <div className="grain lobby-grid relative mx-auto max-w-[1180px] overflow-hidden rounded-card border border-line bg-paper px-5 py-8 md:px-9 md:py-11">
        {/* One warm lamp over the counter, from above and to the left — the same
            direction every other shadow in the app is cast from. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(780px at 6% -18%, rgba(226,35,26,0.22), transparent 62%)",
          }}
        />

        <div className="relative grid grid-cols-1 items-center gap-9 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
          <div className="flex flex-col items-start gap-5">
            <Reveal>
              <span className="inline-flex items-center gap-2.5 rounded-tag bg-canvas-2 py-1.5 pl-1.5 pr-3.5 text-[11px] font-bold text-ink-dim outline outline-1 -outline-offset-1 outline-line">
                <span className="rounded-tag bg-astra px-2 py-1 tag text-white">Escrow aktif</span>
                Uang aman sampai barang diterima
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="max-w-[17ch] font-display text-display font-extrabold text-ink">
                Robux masuk akunmu dalam hitungan menit
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="max-w-[54ch] text-[13px] leading-relaxed text-ink-dim md:text-sm">
                Pilih metode, tentukan nominal, bayar. Dana ditahan platform dan baru cair ke
                penjual setelah Robux masuk. Tanpa transfer langsung, tanpa password akun melayang.
              </p>
            </Reveal>

            <Reveal delay={0.15} className="w-full">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                {/* The icon goes through `trailingIcon`, not into the children:
                    children are wrapped in one truncating span, so an icon
                    passed as a child becomes part of the label and wraps. */}
                <ButtonLink
                  href="/katalog"
                  trailingIcon={<IconArrowRight size={16} />}
                  className="w-full sm:w-auto"
                >
                  Jelajahi katalog
                </ButtonLink>
                <ButtonLink href="/dashboard/penjual" variant="secondary" className="w-full sm:w-auto">
                  Jual di Blox Astra
                </ButtonLink>
              </div>
            </Reveal>

            <Reveal delay={0.18}>
              {/* A ledger strip, not a row of pills: the three guarantees read as
                  one stamped line across the band. */}
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[12px]">
                {TRUST.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-1.5 font-bold text-ink-dim">
                    <Icon size={14} className="text-astra-ink" />
                    {label}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={0.12} y={28} className="w-full">
            <div className="relative mx-auto w-full max-w-[400px] lg:max-w-none">
              {/* The counter is recessed into the band — darker than the wall it
                  sits in, the inverse of a card floating above a page. */}
              <div className="rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line-strong md:p-5">
                <span aria-hidden className="mb-4 block h-0.5 w-10 rounded-full bg-astra" />

                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <IconBolt size={16} className="text-astra-ink" />
                    <span className="text-[13px] font-extrabold text-ink">Beli cepat</span>
                  </span>
                  <LivePill tone="astra" label="Harga live" />
                </div>

                {/* Segmented control: one recessed track with a raised block for
                    the active option, instead of three identical boxes. */}
                <div className="mt-4 grid grid-cols-3 gap-1 rounded-well bg-canvas-2 p-1">
                  {METHODS.map((item) => {
                    const active = method === item.kind;
                    return (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => {
                          setMethod(item.kind);
                          setNominal(null);
                        }}
                        aria-pressed={active}
                        className={cx(
                          "flex flex-col items-center gap-0.5 rounded-control px-1.5 py-2 transition-colors duration-200 ease-[var(--ease-astra)]",
                          active
                            ? "bg-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                            : "text-ink-dim hover:text-ink",
                        )}
                      >
                        <span
                          className={cx(
                            "text-[12px] font-extrabold",
                            active ? "text-ink" : "text-ink-dim",
                          )}
                        >
                          {item.label}
                        </span>
                        <span className="text-[10px] text-ink-mute">{item.hint}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-col gap-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {config.quickPackRobux.map((pack) => {
                      const active = amount === pack;
                      return (
                        <button
                          key={pack}
                          type="button"
                          onClick={() => setNominal(pack)}
                          className={cx(
                            "num rounded-tag px-3 py-1.5 text-[12px] font-bold outline outline-1 -outline-offset-1 transition-colors duration-200",
                            active
                              ? "bg-gold text-on-gold outline-gold"
                              : "bg-paper text-ink-dim outline-line hover:text-ink",
                          )}
                        >
                          {pack.toLocaleString("id-ID")}
                        </button>
                      );
                    })}
                  </div>

                  <label className="flex items-center gap-2 rounded-well bg-canvas-2 px-4 py-3 outline outline-1 -outline-offset-1 outline-line focus-within:outline-2 focus-within:outline-astra/70">
                    <input
                      value={amount}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
                        setNominal(
                          Number(digits) > 0 ? clampRobuxAmount(config, digits) : config.minRobux,
                        );
                      }}
                      inputMode="numeric"
                      aria-label="Nominal Robux"
                      className="num w-full bg-transparent text-[15px] font-extrabold text-ink outline-none"
                    />
                    <span className="shrink-0 text-[11px] font-bold text-ink-mute">Robux</span>
                  </label>
                  <span className="num text-[10px] text-ink-mute">
                    Min {config.minRobux.toLocaleString("id-ID")} · maks{" "}
                    {config.maxRobux.toLocaleString("id-ID")} Robux
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-well bg-canvas-2 px-4 py-3.5 outline outline-1 -outline-offset-1 outline-line">
                  <span className="tag text-ink-mute">Total bayar</span>
                  <span className="price text-[19px] text-gold">{formatIDR(total)}</span>
                </div>

                {/* A real link, not a scripted navigation: this is a route
                    change, so it has to stay client-side routed. */}
                <ButtonLink
                  href={checkoutHref}
                  size="lg"
                  fullWidth
                  className="mt-4"
                  trailingIcon={<IconArrowRight size={16} />}
                >
                  Lanjut beli via {config.via.replace("Via ", "")}
                </ButtonLink>
                <p className="mt-3 text-center text-[10px] leading-relaxed text-ink-mute">
                  Nominal yang kamu pilih ikut terbawa, dan bisa diubah lagi di halaman
                  pembelian.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
