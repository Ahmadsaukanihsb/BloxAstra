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
  username: { label: "Robux via Username", badge: "Langsung Masuk", badgeColor: "bg-success" },
  login: { label: "Robux via Login", badge: "Proses Kilat", badgeColor: "bg-info" },
  gamepass: { label: "Robux via Gamepass", badge: "Pending 5 Hari", badgeColor: "bg-warn" },
  premium: { label: "Roblox Premium", badge: "Proses Seller", badgeColor: "bg-ink" },
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
                ? "border-astra bg-paper text-astra ring-4 ring-astra/10"
                : "border-line bg-paper text-ink-dim shadow-xs hover:border-line-strong hover:text-ink",
            )}
          >
            <span
              className={cx(
                "grid size-6 place-items-center rounded-full transition-colors",
                active ? "bg-astra/[0.06] text-astra" : "bg-canvas-2 text-ink-mute",
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
        className="eyebrow text-ink-mute"
      >
        Punya Kode Promo / Voucher?
      </label>

      {applied ? (
        <div className="flex items-center justify-between gap-2 rounded-control border border-success/25 bg-success/[0.06] px-3.5 py-2.5">
          <span className="num flex items-center gap-2 text-[12px] font-extrabold text-success">
            <IconCheck size={13} />
            {code} · −{formatIDR(appliedCut)}
          </span>
          <button
            type="button"
            onClick={remove}
            className="text-[11px] font-bold text-ink-mute transition-colors hover:text-ink"
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
            className="num flex-1 rounded-control border border-line bg-canvas px-3.5 py-2.5 text-[12px] font-extrabold uppercase text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-astra"
          />
          <button
            type="button"
            disabled={!code.trim() || checking}
            onClick={apply}
            className="rounded-control bg-astra-bright px-4 py-2.5 text-[12px] font-extrabold text-white transition-all hover:bg-astra active:scale-95 disabled:opacity-40"
          >
            {checking ? "Memeriksa…" : "Pakai"}
          </button>
        </div>
      )}

      {error ? <p className="text-[11px] font-semibold text-astra-ink">{error}</p> : null}
    </div>
  );
}

/** Explains why every `/beli/robux-*` order must be placed while signed in. */
export function LoginRequiredNotice() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-well border border-warn/25 bg-warn/[0.06] p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-warn">
          <IconLock size={16} />
        </span>
        <div className="flex flex-col">
          <span className="text-[12px] font-extrabold text-warn">
            Login ke Blox Astra Diperlukan
          </span>
          <span className="text-[10px] text-robux">
            Kamu harus login untuk membuat pesanan.
          </span>
        </div>
      </div>
      <Link
        href="/masuk"
        className="shrink-0 rounded-control bg-robux px-3.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-warn"
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
  accentClass = "focus-within:border-astra focus-within:ring-astra/10",
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
        className="mb-1.5 block eyebrow text-ink-mute"
      >
        Username Roblox
      </label>
      <div className="flex items-stretch gap-2">
        <div
          className={`flex flex-1 items-center gap-3 rounded-well border-2 border-line bg-paper px-4 py-3.5 transition-all focus-within:ring-4 ${accentClass}`}
        >
          <span className="text-base font-bold text-ink-mute">@</span>
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
            className="w-full bg-transparent text-[15px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-mute"
          />
        </div>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking || value.trim().length === 0}
          className="shrink-0 rounded-well bg-ink px-4 text-[12px] font-extrabold uppercase tracking-wide text-white transition-all hover:bg-ink-dim active:scale-95 disabled:opacity-40"
        >
          {checking ? "…" : "Cek"}
        </button>
      </div>
      {verified ? (
        <div className="mt-2.5 flex items-center gap-3 rounded-well border border-success/25 bg-success/5 p-3">
          {avatar ? (
            // Roblox CDN headshot — plain img, fail-soft by design.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={`Avatar ${verifiedName}`}
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-well bg-paper object-cover outline outline-1 -outline-offset-1 outline-success/25"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-well bg-success/10 text-success">
              <IconCheck size={18} />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="num truncate text-[13px] font-extrabold text-ink">
                @{verifiedName}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                <IconCheck size={10} />
                Terverifikasi
              </span>
            </span>
            <span className="truncate text-[11px] text-ink-mute">
              {displayName && displayName.toLowerCase() !== verifiedName.toLowerCase()
                ? `${displayName} · Akun Roblox ditemukan`
                : "Akun Roblox ditemukan. Robux akan masuk ke akun ini."}
            </span>
          </div>
        </div>
      ) : error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-astra-ink">
          <IconAlert size={13} />
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-ink-mute">
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
        className="flex w-full items-center justify-center gap-2.5 rounded-well bg-gradient-to-r from-astra to-astra-bright py-4 text-[15px] font-extrabold uppercase tracking-wide text-white transition-all hover:brightness-105 active:scale-[0.98]"
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
      className="flex w-full items-center justify-center gap-2.5 rounded-well bg-gradient-to-r from-astra to-astra-bright py-4 text-[15px] font-extrabold uppercase tracking-wide text-white transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
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
