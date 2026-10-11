"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatIDR } from "@/lib/format";
import { robuxOrderConfig, robuxOrderPrice, type RobuxOrderKind } from "@/lib/robux-orders";
import { useRateStore } from "@/components/rates/rate-store";
import { LivePill } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { cx } from "@/lib/cx";
import {
  IconArrowRight,
  IconBolt,
  IconHexCoin,
  IconShieldCheck,
} from "@/components/ui/icons";

const METHODS: { kind: RobuxOrderKind; label: string; hint: string }[] = [
  { kind: "username", label: "Username", hint: "Langsung masuk" },
  { kind: "login", label: "Login", hint: "Proses kilat" },
  { kind: "gamepass", label: "Gamepass", hint: "Paling hemat" },
];

/** Hero with a live quick-buy widget — every price quotes the active rate card. */
export function Hero() {
  const { rates } = useRateStore();
  const [method, setMethod] = useState<RobuxOrderKind>("username");
  const [nominal, setNominal] = useState<number | null>(null);

  const config = useMemo(() => robuxOrderConfig(method, rates.orders), [method, rates]);
  const amount = nominal ?? config.initialRobux;
  const total = robuxOrderPrice(config, amount);

  function clamp(value: number): number {
    const stepped = Math.round(value / config.step) * config.step;
    return Math.min(config.maxRobux, Math.max(config.minRobux, stepped));
  }

  return (
    <section className="relative px-4 pt-4 md:px-8 md:pt-6">
      <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-card border border-line bg-paper px-5 py-7 md:px-8 md:py-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(620px at 14% 4%, rgba(226,35,26,0.07), transparent 70%)",
          }}
        />
        <div className="relative grid grid-cols-1 items-center gap-7 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="flex flex-col items-start gap-4">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-canvas py-1.5 pl-2 pr-4 text-[11px] text-ink-dim outline outline-1 -outline-offset-1 outline-line">
                <span className="rounded-full bg-astra/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-astra-ink">
                  Escrow aktif
                </span>
                Uang aman sampai barang diterima
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="max-w-[20ch] font-display text-display font-extrabold text-ink">
                Robux masuk akunmu dalam{" "}
                <span className="accent-text relative inline-block">
                  hitungan menit
                  <svg
                    viewBox="0 0 240 12"
                    className="absolute -bottom-1.5 left-0 w-full text-astra-ink/45"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 8.5C46 3.2 150 2.4 238 6.8"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="max-w-[56ch] text-[13px] leading-relaxed text-ink-dim md:text-sm">
                Pilih metode, tentukan nominal, bayar. Dana ditahan platform dan baru cair ke
                penjual setelah Robux masuk. Tanpa transfer langsung, tanpa password akun melayang.
              </p>
            </Reveal>

            <Reveal delay={0.15} className="w-full">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink
                  href="/katalog"
                  trailingIcon={<IconArrowRight size={16} />}
                  iconCircleClassName="bg-paper/20"
                  className="w-full sm:w-auto"
                >
                  Jelajahi katalog
                </ButtonLink>
                <ButtonLink
                  href="/dashboard/penjual"
                  variant="secondary"
                  trailingIcon={<IconArrowRight size={16} />}
                  iconCircleClassName="bg-canvas"
                  className="w-full sm:w-auto"
                >
                  Jual di Blox Astra
                </ButtonLink>
              </div>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[12px]">
                <span className="flex items-center gap-1.5 font-bold text-ink-dim">
                  <IconShieldCheck size={14} className="text-astra" />
                  Dana ditahan escrow
                </span>
                <span className="flex items-center gap-1.5 font-bold text-ink-dim">
                  <IconBolt size={14} className="text-astra" />
                  Penjual terverifikasi KYC
                </span>
                <span className="flex items-center gap-1.5 font-bold text-ink-dim">
                  <IconHexCoin size={14} className="text-astra" />
                  Garansi kembali 100%
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} y={28} className="w-full">
            <div className="relative mx-auto w-full max-w-[380px] lg:max-w-none">
              <div className="bezel-shell p-1.5">
                <div className="bezel-core flex flex-col gap-4 p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <IconBolt size={16} className="text-astra-ink" />
                      <span className="text-[13px] font-extrabold text-ink">Beli cepat</span>
                    </span>
                    <LivePill tone="astra" label="Harga live" />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {METHODS.map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => {
                          setMethod(item.kind);
                          setNominal(null);
                        }}
                        aria-pressed={method === item.kind}
                        className={cx(
                          "flex flex-col items-center gap-0.5 rounded-well px-2 py-2.5 outline outline-1 -outline-offset-1 transition-colors duration-300",
                          method === item.kind
                            ? "bg-astra/[0.07] outline-astra/30"
                            : "bg-canvas outline-line hover:outline-astra/30",
                        )}
                      >
                        <span
                          className={cx(
                            "text-[13px] font-extrabold",
                            method === item.kind ? "text-astra-ink" : "text-ink",
                          )}
                        >
                          {item.label}
                        </span>
                        <span className="text-[10px] text-ink-mute">{item.hint}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {config.quickPackRobux.map((pack) => (
                        <button
                          key={pack}
                          type="button"
                          onClick={() => setNominal(pack)}
                          className={cx(
                            "num rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors duration-200",
                            amount === pack
                              ? "bg-astra text-white"
                              : "bg-canvas text-ink-dim outline outline-1 -outline-offset-1 outline-line hover:text-ink",
                          )}
                        >
                          {pack.toLocaleString("id-ID")}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 rounded-well bg-canvas px-4 py-3 outline outline-1 -outline-offset-1 outline-line focus-within:outline-2 focus-within:outline-astra/60">
                      <input
                        value={amount}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
                          setNominal(digits ? clamp(Number(digits)) : config.minRobux);
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

                  <div className="flex items-center justify-between rounded-well bg-canvas px-4 py-3.5 outline outline-1 -outline-offset-1 outline-line">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-mute">
                      Total bayar
                    </span>
                    <span className="num text-[17px] font-extrabold text-astra-ink">
                      {formatIDR(total)}
                    </span>
                  </div>

                  <Link
                    href={config.href}
                    className="accent-fill flex h-11 w-full items-center justify-center gap-2 rounded-control text-sm font-extrabold text-white transition-[filter] duration-300 hover:brightness-[1.08]"
                  >
                    Lanjut beli via {config.via.replace("Via ", "")}
                    <IconArrowRight size={16} />
                  </Link>
                  <p className="-mt-2 text-center text-[10px] leading-relaxed text-ink-mute">
                    Nominal & metode bisa diubah lagi di halaman pembelian.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
