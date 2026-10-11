"use client";

import { useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { formatIDR } from "@/lib/format";
import { ROBUX_ORDERS, type RobuxOrderKind } from "@/lib/robux-orders";
import { validatePromoAction } from "@/app/actions/orders";
import { verifyRobloxUsername } from "@/app/actions/roblox";
import { IconAlert, IconCheck, IconHexCoin, IconLock } from "@/components/ui/icons";

export const ROBLOX_USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

const TAB_META: Record<
  RobuxOrderKind,
  { label: string; badge: string; badgeColor: string }
> = {
  username: { label: "Robux via Username", badge: "Langsung Masuk", badgeColor: "bg-[#10B981]" },
  login: { label: "Robux via Login", badge: "Proses Kilat", badgeColor: "bg-blue-600" },
  gamepass: { label: "Robux via Gamepass", badge: "Pending 5 Hari", badgeColor: "bg-[#F59E0B]" },
  premium: { label: "Roblox Premium", badge: "Proses Seller", badgeColor: "bg-[#7C3AED]" },
};

/** Cross-links the three `/beli/robux-*` methods. Exactly one is marked active. */
export function RobuxServiceTabs({ current }: { current: RobuxOrderKind }) {
  return (
    <nav aria-label="Metode pembayaran Robux" className="mb-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(ROBUX_ORDERS) as RobuxOrderKind[]).map((kind) => {
        const config = ROBUX_ORDERS[kind];
        const meta = TAB_META[kind];
        const active = kind === current;
        return (
          <Link
            key={kind}
            href={config.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group relative flex w-full items-center justify-center gap-2 rounded-full border-2 px-4 py-2.5 text-[13px] font-bold transition-all duration-200",
              active
                ? "border-[#E11D48] bg-white text-[#E11D48] shadow-[0_4px_16px_rgba(225,29,72,0.15)] ring-4 ring-[#E11D48]/10"
                : "border-slate-200 bg-white text-slate-600 shadow-xs hover:border-slate-300 hover:text-slate-900",
            )}
          >
            <span
              className={cx(
                "grid size-6 place-items-center rounded-full transition-colors",
                active ? "bg-rose-50 text-[#E11D48]" : "bg-slate-100 text-slate-500",
              )}
            >
              <IconHexCoin size={15} />
            </span>
            <span>{meta.label}</span>
            <span
              className={cx(
                "rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-xs",
                meta.badgeColor,
              )}
            >
              {meta.badge}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Voucher field. Owns the code input and reports the discount to the parent so
 * the order summary can show the discounted total. Validated server-side.
 */
export function PromoField({
  subtotal,
  onCutChange,
  onCodeChange,
}: {
  subtotal: number;
  onCutChange: (cut: number) => void;
  onCodeChange?: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(false);
  const [appliedCut, setAppliedCut] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function apply() {
    setChecking(true);
    setError(null);
    try {
      const result = await validatePromoAction(code, subtotal);
      if (result.ok) {
        setApplied(true);
        setAppliedCut(result.cut);
        onCutChange(result.cut);
        onCodeChange?.(code.trim().toUpperCase());
      } else {
        setApplied(false);
        setAppliedCut(0);
        onCutChange(0);
        setError(result.error);
      }
    } finally {
      setChecking(false);
    }
  }

  function remove() {
    setApplied(false);
    setAppliedCut(0);
    setCode("");
    setError(null);
    onCutChange(0);
    onCodeChange?.("");
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="promo-code-input"
        className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500"
      >
        Punya Kode Promo / Voucher?
      </label>

      {applied ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
          <span className="num flex items-center gap-2 text-[12px] font-extrabold text-emerald-700">
            <IconCheck size={13} />
            {code} · −{formatIDR(appliedCut)}
          </span>
          <button
            type="button"
            onClick={remove}
            className="text-[11px] font-bold text-slate-500 transition-colors hover:text-slate-900"
          >
            Hapus
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            id="promo-code-input"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="KODE PROMO"
            className="num flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12px] font-extrabold uppercase text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#E11D48]"
          />
          <button
            type="button"
            disabled={!code.trim() || checking}
            onClick={apply}
            className="rounded-xl bg-[#F43F5E] px-4 py-2.5 text-[12px] font-extrabold text-white transition-all hover:bg-[#E11D48] active:scale-95 disabled:opacity-40"
          >
            {checking ? "Memeriksa…" : "Pakai"}
          </button>
        </div>
      )}

      {error ? <p className="text-[11px] font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

/** Explains why every `/beli/robux-*` order must be placed while signed in. */
export function LoginRequiredNotice() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-[#FFFBEB] p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-amber-600">
          <IconLock size={16} />
        </span>
        <div className="flex flex-col">
          <span className="text-[12px] font-extrabold text-[#92400E]">
            Login ke Blox Astra Diperlukan
          </span>
          <span className="text-[10px] text-[#B45309]">
            Kamu harus login untuk membuat pesanan.
          </span>
        </div>
      </div>
      <Link
        href="/masuk"
        className="shrink-0 rounded-lg bg-[#D97706] px-3.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-[#B45309]"
      >
        Login
      </Link>
    </div>
  );
}

/**
 * Username field with a live Roblox existence check. The parent owns the
 * input value and the verified canonical name; typing resets verification.
 */
export function UsernameVerifyField({
  id,
  value,
  onChange,
  verifiedName,
  onVerified,
  accentClass = "focus-within:border-[#E11D48] focus-within:ring-rose-500/10",
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  verifiedName: string | null;
  onVerified: (next: string | null, avatarUrl?: string | null) => void;
  accentClass?: string;
}) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  async function check() {
    const handle = value.trim();
    setError(null);
    setAvatar(null);
    setDisplayName(null);
    onVerified(null);
    if (!ROBLOX_USERNAME_RE.test(handle)) {
      setError("Username Roblox tidak valid (3–20 karakter: huruf, angka, underscore).");
      return;
    }
    setChecking(true);
    try {
      const result = await verifyRobloxUsername(handle);
      if (!result.ok) {
        setError(result.error);
      } else if (!result.found) {
        setError(`Username @${handle} tidak ditemukan di Roblox. Periksa ejaan.`);
      } else {
        setAvatar(result.avatarUrl);
        setDisplayName(result.displayName);
        onVerified(result.canonicalName ?? handle, result.avatarUrl);
      }
    } finally {
      setChecking(false);
    }
  }

  const verified =
    verifiedName !== null && verifiedName.toLowerCase() === value.trim().toLowerCase();

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
      >
        Username Roblox
      </label>
      <div className="flex items-stretch gap-2">
        <div
          className={`flex flex-1 items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 transition-all focus-within:ring-4 ${accentClass}`}
        >
          <span className="text-base font-bold text-slate-400">@</span>
          <input
            id={id}
            type="text"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              onVerified(null);
              setAvatar(null);
              setDisplayName(null);
              setError(null);
            }}
            placeholder="contoh: ecayeo4"
            aria-label="Username Roblox"
            className="w-full bg-transparent text-[15px] font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking || value.trim().length === 0}
          className="shrink-0 rounded-2xl bg-slate-900 px-4 text-[12px] font-extrabold uppercase tracking-wide text-white transition-all hover:bg-slate-700 active:scale-95 disabled:opacity-40"
        >
          {checking ? "…" : "Cek"}
        </button>
      </div>
      {verified ? (
        <div className="mt-2.5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
          {avatar ? (
            // Roblox CDN headshot — plain img, fail-soft by design.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={`Avatar ${verifiedName}`}
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-2xl bg-white object-cover outline outline-1 -outline-offset-1 outline-emerald-200"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <IconCheck size={18} />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="num truncate text-[13px] font-extrabold text-slate-900">
                @{verifiedName}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                <IconCheck size={10} />
                Terverifikasi
              </span>
            </span>
            <span className="truncate text-[11px] text-slate-500">
              {displayName && displayName.toLowerCase() !== verifiedName.toLowerCase()
                ? `${displayName} · Akun Roblox ditemukan`
                : "Akun Roblox ditemukan — Robux akan masuk ke akun ini."}
            </span>
          </div>
        </div>
      ) : error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
          <IconAlert size={13} />
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Tekan Cek untuk memastikan username benar-benar ada.
        </p>
      )}
    </div>
  );
}

/** The single call to action on every `/beli/robux-*` page. */
export function RobuxMainCta({
  enabled,
  priceLabel,
  onPay,
  paying,
}: {
  enabled: boolean;
  priceLabel?: string;
  onPay?: () => void;
  paying?: boolean;
}) {
  if (!enabled) {
    return (
      <Link
        href="/masuk"
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#E11D48] to-[#F43F5E] py-4 text-[15px] font-extrabold uppercase tracking-wide text-white shadow-[0_8px_24px_rgba(225,29,72,0.32)] transition-all hover:brightness-105 active:scale-[0.98]"
      >
        <span>LOGIN UNTUK MEMBELI</span>
        <IconLock size={16} />
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onPay}
      disabled={paying}
      className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#E11D48] to-[#F43F5E] py-4 text-[15px] font-extrabold uppercase tracking-wide text-white shadow-[0_8px_24px_rgba(225,29,72,0.32)] transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
    >
      <span>{paying ? "MEMPROSES…" : `BAYAR ${priceLabel ?? ""}`.trim()}</span>
      {paying ? (
        <span className="size-4 animate-[orbit_0.9s_linear_infinite] rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <IconLock size={16} />
      )}
    </button>
  );
}
