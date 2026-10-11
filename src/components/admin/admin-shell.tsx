"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  resolveDispute,
  releaseEscrow,
  updateRateCard,
  resetRateCard,
  approveWithdrawal,
  rejectWithdrawal,
} from "@/app/actions/admin";
import type { AdminDisputeRow, AdminEscrowRow, AdminAuditRow, AdminWithdrawalRow } from "@/lib/admin";
import type { RobuxOrderRates } from "@/lib/robux-orders";
import type { RateCard } from "@/lib/robux-pricing";
import { formatDateTime, formatIDR } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/field";
import { ProductArt } from "@/components/ui/art";
import { SectionHeading, StatRow } from "@/components/ui/surface";
import { StatusPill } from "@/components/order/runtime";
import {
  IconAlert,
  IconCheck,
  IconFileText,
  IconRefresh,
  IconScale,
  IconShieldCheck,
  IconWallet,
} from "@/components/ui/icons";

type Tab = "sengketa" | "escrow" | "tarik" | "rate" | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "sengketa", label: "Antrean sengketa" },
  { id: "escrow", label: "Escrow & pencairan" },
  { id: "tarik", label: "Penarikan" },
  { id: "rate", label: "Rate Robux" },
  { id: "audit", label: "Jejak audit" },
];

const RBAC: { action: string; allowed: boolean }[] = [
  { action: "Arbitrase mediasi sengketa", allowed: true },
  { action: "Eksekusi manual payout", allowed: true },
  { action: "Manajemen stok & produk", allowed: false },
  { action: "Manipulasi Protection Fund", allowed: false },
];

interface InitialRates {
  card: RateCard;
  orders: RobuxOrderRates;
}

export function AdminShell({
  initialDisputes,
  initialEscrow,
  initialWithdrawals,
  initialAuditLogs,
  initialRates,
  adminName,
  adminEmail,
  totals,
}: {
  initialDisputes: AdminDisputeRow[];
  initialEscrow: AdminEscrowRow[];
  initialWithdrawals: AdminWithdrawalRow[];
  initialAuditLogs: AdminAuditRow[];
  initialRates: InitialRates;
  adminName: string;
  adminEmail: string;
  totals: {
    heldTotal: number;
    escrowCount: number;
    openDisputeCount: number;
    pendingWithdrawalCount: number;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    paramTab && TABS.some((item) => item.id === (paramTab as Tab))
      ? (paramTab as Tab)
      : "sengketa",
  );
  const [flash, setFlash] = useState<string | null>(null);

  const [disputes, setDisputes] = useState(initialDisputes);
  const [escrow, setEscrow] = useState(initialEscrow);
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
  const [logs] = useState(initialAuditLogs);

  async function handleResolve(orderCode: string, outcome: "refund" | "release") {
    const result = await resolveDispute({ orderCode, outcome });
    if (!result.ok) {
      setFlash(result.error);
      return;
    }
    setDisputes((prev) => prev.filter((d) => d.code !== orderCode));
    setEscrow((prev) => prev.filter((e) => e.code !== orderCode));
    setFlash(
      outcome === "refund"
        ? `Sengketa ${orderCode} diterima. Refund dikirim ke pembeli.`
        : `Sengketa ${orderCode} ditolak. Dana dicairkan ke penjual.`,
    );
    router.refresh();
  }

  async function handleRelease(orderCode: string) {
    const result = await releaseEscrow({ orderCode });
    if (!result.ok) {
      setFlash(result.error);
      return;
    }
    setEscrow((prev) => prev.filter((e) => e.code !== orderCode));
    setFlash(`Manual payout untuk ${orderCode} dieksekusi.`);
    router.refresh();
  }

  async function handleApproveWithdrawal(ref: string) {
    const result = await approveWithdrawal(ref);
    if (!result.ok) {
      setFlash(result.error);
      return;
    }
    setWithdrawals((prev) => prev.filter((w) => w.ref !== ref));
    setFlash(`Penarikan ${ref} disetujui. Dana dicairkan ke rekening penjual.`);
    router.refresh();
  }

  async function handleRejectWithdrawal(ref: string, reason: string) {
    const result = await rejectWithdrawal({ ref, reason });
    if (!result.ok) {
      setFlash(result.error);
      return;
    }
    setWithdrawals((prev) => prev.filter((w) => w.ref !== ref));
    setFlash(`Penarikan ${ref} ditolak. Dana dikembalikan ke dompet penjual.`);
    router.refresh();
  }

  const heldTotal = totals.heldTotal;
  const stats = [
    { label: "Dana ditahan escrow", value: formatIDR(heldTotal), tone: "astra" as const },
    {
      label: "Sengketa menunggu putusan",
      value: String(totals.openDisputeCount),
      tone: totals.openDisputeCount > 0 ? ("danger" as const) : ("neutral" as const),
    },
    { label: "Pesanan dalam escrow", value: String(totals.escrowCount), tone: "robux" as const },
    {
      label: "Penarikan menunggu",
      value: String(totals.pendingWithdrawalCount),
      tone: totals.pendingWithdrawalCount > 0 ? ("warn" as const) : ("neutral" as const),
    },
    { label: "Entri jejak audit", value: String(logs.length), tone: "neutral" as const },
  ];

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        eyebrow="Ruang kontrol"
        title="Panel admin Blox Astra"
        description="Arbitrase sengketa, pencairan manual, dan jejak audit tercatat di tabel admin_audit_logs."
      />

      <div className="flex items-center flex-wrap gap-2.5">
        <Badge tone="astra" icon={<IconShieldCheck size={13} />}>
          {adminName || adminEmail} · admin
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1.5 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
          >
            <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              {stat.label}
            </span>
            <span
              className={cx(
                "num text-[17px] font-extrabold",
                stat.tone === "astra"
                  ? "text-astra-ink"
                  : stat.tone === "robux"
                    ? "text-robux"
                    : stat.tone === "danger"
                      ? "text-danger"
                      : stat.tone === "warn"
                        ? "text-warn"
                        : "text-ink",
              )}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 rounded-full bg-canvas p-1 outline outline-1 -outline-offset-1 outline-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cx(
              "flex-1 rounded-full px-4 py-2 text-[12px] font-bold transition-colors duration-300",
              tab === item.id
                ? "bg-astra text-white"
                : "text-ink-dim hover:bg-canvas-2 hover:text-ink",
            )}
          >
            {item.label}
            {item.id === "sengketa" && disputes.length > 0 ? (
              <span
                className={cx(
                  "num ml-2 rounded-full px-1.5 py-0.5 text-[10px]",
                  // The active tab is solid crimson, so the tone-coloured badge
                  // would sink into it. On crimson, invert to a light chip.
                  tab === item.id
                    ? "bg-paper/25 text-white"
                    : "bg-danger/15 text-danger",
                )}
              >
                {disputes.length}
              </span>
            ) : null}
            {item.id === "tarik" && withdrawals.length > 0 ? (
              <span
                className={cx(
                  "num ml-2 rounded-full px-1.5 py-0.5 text-[10px]",
                  tab === item.id ? "bg-paper/25 text-white" : "bg-warn/15 text-warn",
                )}
              >
                {withdrawals.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tercatat di admin_audit_logs">
          {flash}
        </Notice>
      ) : null}

      {tab === "sengketa" ? <DisputeQueue orders={disputes} onResolve={handleResolve} /> : null}
      {tab === "escrow" ? <EscrowLedger orders={escrow} onRelease={handleRelease} /> : null}
      {tab === "tarik" ? (
        <WithdrawalQueue
          rows={withdrawals}
          onApprove={handleApproveWithdrawal}
          onReject={handleRejectWithdrawal}
        />
      ) : null}
      {tab === "rate" ? <RateRobuxEditor initialRates={initialRates} /> : null}
      {tab === "audit" ? <AuditLog logs={logs} /> : null}
    </div>
  );
}

function DisputeQueue({
  orders,
  onResolve,
}: {
  orders: AdminDisputeRow[];
  onResolve: (orderCode: string, outcome: "refund" | "release") => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<IconCheck size={22} />}
        title="Antrean sengketa bersih"
        description="Tidak ada kasus yang menunggu putusan. Kasus baru muncul ketika pembeli mengajukan sengketa dari ruang pesanan."
        action={
          <Badge tone="success" icon={<IconCheck size={13} />}>
            SLA mediasi terpenuhi
          </Badge>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => (
        <article
          key={order.orderId}
          className="flex flex-col gap-5 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line md:p-6"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusPill state={order.state} />
            <Badge tone="danger" icon={<IconScale size={13} />}>
              {order.dispute.ref}
            </Badge>
            <Badge tone="warn">{order.dispute.reasonLabel}</Badge>
            <span className="num text-[11px] text-ink-mute">
              Sisa waktu putusan {order.dispute.slaHoursLeft} jam
            </span>
          </div>

          <div className="flex items-center gap-4">
            <ProductArt
              seed={order.productSlug || order.code}
              category="item"
              className="size-14 shrink-0 rounded-well"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-extrabold text-ink">{order.productTitle}</span>
              <span className="num text-[11px] text-ink-mute">
                {order.code} · {order.sellerStoreName} · {formatDateTime(order.dispute.openedAt)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-well bg-canvas-2 p-4">
              <span className="eyebrow text-ink-mute">
                Keluhan pembeli
              </span>
              <p className="text-[13px] leading-relaxed text-ink-dim">{order.dispute.buyerNote}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-well bg-canvas-2 p-4">
              <span className="eyebrow text-ink-mute">
                Tanggapan penjual
              </span>
              <p className="text-[13px] leading-relaxed text-ink-dim">
                {order.dispute.sellerReply || "—"}
              </p>
            </div>
          </div>

          {order.dispute.evidence.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 eyebrow text-ink-mute">
                <IconFileText size={13} /> Bukti terlampir
              </span>
              <ul className="flex flex-col gap-1.5">
                {order.dispute.evidence.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[12px] text-ink-dim">
                    <span aria-hidden className="mt-1.5 size-1 rounded-full bg-astra" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatRow label="Nilai pesanan" value={formatIDR(order.total)} tone="astra" />
              <StatRow label="Biaya platform" value={formatIDR(order.platformFee)} />
              <StatRow label="Status escrow" value="Dana dibekukan" tone="danger" />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                leadingIcon={<IconScale size={16} />}
                onClick={() => onResolve(order.code, "refund")}
              >
                Terima sengketa, refund ke pembeli
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<IconWallet size={16} />}
                onClick={() => onResolve(order.code, "release")}
              >
                Tolak sengketa, cairkan ke penjual
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EscrowLedger({
  orders,
  onRelease,
}: {
  orders: AdminEscrowRow[];
  onRelease: (orderCode: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <div
          key={order.orderId}
          className="flex flex-col gap-4 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line md:flex-row md:items-center md:justify-between"
        >
          <div className="flex min-w-0 items-center gap-4">
            <ProductArt
              seed={order.productSlug || order.code}
              category="item"
              className="size-11 shrink-0 rounded-control"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-[13px] font-bold text-ink">{order.code}</span>
                <StatusPill state={order.state} />
              </div>
              <span className="truncate text-[11px] text-ink-mute">
                {order.productTitle} · {order.sellerStoreName}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 md:justify-end">
            <span className="num text-sm font-extrabold text-astra-ink">
              {formatIDR(order.total)}
            </span>
            {order.waitingArbitration ? (
              <Badge tone="warn" icon={<IconScale size={13} />}>
                Menunggu arbitrase
              </Badge>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<IconWallet size={15} />}
                onClick={() => onRelease(order.code)}
              >
                Eksekusi manual payout
              </Button>
            )}
          </div>
        </div>
      ))}

      <Notice tone="info" icon={<IconAlert size={15} />} title="Aturan escrow">
        Payout manual hanya sah untuk pesanan berstatus paid, processing, atau shipped. Pesanan
        yang sedang disengketakan dibekukan sampai putusan arbitrase tercatat di log audit.
      </Notice>
    </div>
  );
}

function WithdrawalQueue({
  rows,
  onApprove,
  onReject,
}: {
  rows: AdminWithdrawalRow[];
  onApprove: (ref: string) => void | Promise<void>;
  onReject: (ref: string, reason: string) => void | Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconWallet size={22} />}
        title="Tidak ada penarikan menunggu"
        description="Penajuan penarikan penjual akan muncul di sini untuk disetujui atau ditolak. Penolakan otomatis mengembalikan dana ke dompet penjual."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <WithdrawalRow key={row.id} row={row} onApprove={onApprove} onReject={onReject} />
      ))}

      <Notice tone="info" icon={<IconAlert size={15} />} title="Alur penarikan">
        Saldo sudah dipotong saat penjual mengajukan penarikan. Menyetujui hanya menandai dana
        terkirim; menolak mengembalikan dana (amount + biaya) ke dompet penjual. Keduanya tercatat
        di log audit.
      </Notice>
    </div>
  );
}

function WithdrawalRow({
  row,
  onApprove,
  onReject,
}: {
  row: AdminWithdrawalRow;
  onApprove: (ref: string) => void | Promise<void>;
  onReject: (ref: string, reason: string) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function handleApprove() {
    setPending(true);
    await onApprove(row.ref);
    setPending(false);
  }

  async function handleReject() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) return;
    setPending(true);
    await onReject(row.ref, trimmed);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="warn" icon={<IconWallet size={13} />}>
          {row.ref}
        </Badge>
        <span className="num text-[13px] font-bold text-ink">{formatIDR(row.amount + row.fee)}</span>
        <span className="text-[11px] text-ink-mute">
          {formatIDR(row.amount)} + biaya {formatIDR(row.fee)}
        </span>
        <span className="num ml-auto text-[11px] text-ink-mute">{formatDateTime(row.createdAt)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-well bg-canvas-2 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-bold text-ink">{row.storeName}</span>
          <span className="num text-[11px] text-ink-mute">
            {row.bank} · ····{row.accountNumber.slice(-4)}
          </span>
        </div>
        {mode === "view" ? (
          <div className="flex flex-wrap gap-2.5">
            <Button
              size="sm"
              leadingIcon={<IconCheck size={15} />}
              disabled={pending}
              onClick={() => void handleApprove()}
            >
              Setujui
            </Button>
            <Button
              variant="danger"
              size="sm"
              leadingIcon={<IconAlert size={15} />}
              disabled={pending}
              onClick={() => setMode("reject")}
            >
              Tolak
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[320px]">
            <Field label="Alasan penolakan" htmlFor={`reject-${row.ref}`}>
              <TextInput
                id={`reject-${row.ref}`}
                value={reason}
                placeholder="Mis. data rekening tidak sesuai KYC"
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <div className="flex gap-2.5">
              <Button
                variant="danger"
                size="sm"
                disabled={pending || reason.trim().length < 3}
                onClick={() => void handleReject()}
              >
                {pending ? "Memproses…" : "Konfirmasi tolak"}
              </Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => setMode("view")}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditLog({ logs }: { logs: AdminAuditRow[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {logs.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-col gap-3 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone={entry.actor.startsWith("admin") ? "astra" : "neutral"}>
                {entry.actionType}
              </Badge>
              <span className="num text-[11px] text-ink-mute">
                {entry.targetResource}:{entry.targetId}
              </span>
              <span className="num ml-auto text-[11px] text-ink-mute">
                {formatDateTime(entry.createdAt)}
              </span>
            </div>
            <code className="num block overflow-x-auto rounded-control bg-canvas-2 px-3 py-2 text-[11px] leading-relaxed text-ink-dim">
              {entry.diffPayload}
            </code>
            <div className="flex flex-wrap gap-3 text-[11px] text-ink-mute">
              <span className="num">actor {entry.actor}</span>
              <span className="num">ip {entry.ipAddress}</span>
              <span className="num">id {entry.id}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
        <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-ink">
          Matriks hak akses admin (PRD §10)
        </span>
        {RBAC.map((row) => (
          <div
            key={row.action}
            className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-b-0"
          >
            <span className="text-xs text-ink-dim">{row.action}</span>
            <Badge
              tone={row.allowed ? "success" : "muted"}
              icon={row.allowed ? <IconCheck size={13} /> : <IconAlert size={13} />}
            >
              {row.allowed ? "Diizinkan" : "Superadmin"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Rate Robux editor ─── */

type RateFields = {
  cover: string;
  noCover: string;
  vol2000: string;
  vol5000: string;
  vol10000: string;
  rateUsername: string;
  rateLogin: string;
  rateGamepass: string;
  ratePremium: string;
  adminFee: string;
};

function fieldsFrom(rates: InitialRates): RateFields {
  return {
    cover: String(rates.card.cover),
    noCover: String(rates.card.noCover),
    vol2000: String(rates.card.volume.at2000 * 100),
    vol5000: String(rates.card.volume.at5000 * 100),
    vol10000: String(rates.card.volume.at10000 * 100),
    rateUsername: String(rates.orders.username),
    rateLogin: String(rates.orders.login),
    rateGamepass: String(rates.orders.gamepass),
    ratePremium: String(rates.orders.premium),
    adminFee: String(rates.orders.adminFee),
  };
}

function parsePositive(raw: string): number | null {
  const value = Number(raw.replace(",", ".").trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseNonNegative(raw: string): number | null {
  const value = Number(raw.replace(",", ".").trim());
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function ratesFromFields(fields: RateFields): InitialRates | null {
  const cover = parsePositive(fields.cover);
  const noCover = parsePositive(fields.noCover);
  const at2000 = parseNonNegative(fields.vol2000);
  const at5000 = parseNonNegative(fields.vol5000);
  const at10000 = parseNonNegative(fields.vol10000);
  const username = parsePositive(fields.rateUsername);
  const login = parsePositive(fields.rateLogin);
  const gamepass = parsePositive(fields.rateGamepass);
  const premium = parsePositive(fields.ratePremium);
  const adminFee = parsePositive(fields.adminFee);
  const values = [cover, noCover, at2000, at5000, at10000, username, login, gamepass, premium, adminFee];
  if (values.some((value) => value === null)) return null;
  const [c, n, v2, v5, v10, u, l, g, p, f] = values as [
    number, number, number, number, number, number, number, number, number, number,
  ];
  return {
    card: {
      cover: c,
      noCover: n,
      volume: { at2000: v2 / 100, at5000: v5 / 100, at10000: v10 / 100 },
    },
    orders: { username: u, login: l, gamepass: g, premium: p, adminFee: f },
  };
}

function ratesEqual(a: InitialRates, b: InitialRates): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function RateInput({
  id,
  label,
  hint,
  suffix,
  value,
  allowZero = false,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  suffix: string;
  value: string;
  allowZero?: boolean;
  onChange: (next: string) => void;
}) {
  const invalid = allowZero
    ? parseNonNegative(value) === null
    : parsePositive(value) === null;

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        <TextInput
          id={id}
          inputMode="decimal"
          value={value}
          invalid={invalid}
          className="pr-28"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink-mute">
          {suffix}
        </span>
      </div>
    </Field>
  );
}

function RateRobuxEditor({ initialRates }: { initialRates: InitialRates }) {
  const router = useRouter();
  const [fields, setFields] = useState<RateFields | null>(null);
  const effective = fields ?? fieldsFrom(initialRates);

  const draft = ratesFromFields(effective);
  const dirty = draft !== null && !ratesEqual(draft, initialRates);

  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(key: keyof RateFields, value: string) {
    setFields({ ...(fields ?? fieldsFrom(initialRates)), [key]: value });
  }

  async function applyDraft() {
    if (!draft || !dirty) return;
    setPending(true);
    setError(null);
    const result = await updateRateCard({
      cover: draft.card.cover,
      noCover: draft.card.noCover,
      vol2000: draft.card.volume.at2000 * 100,
      vol5000: draft.card.volume.at5000 * 100,
      vol10000: draft.card.volume.at10000 * 100,
      orderUsername: draft.orders.username,
      orderLogin: draft.orders.login,
      orderGamepass: draft.orders.gamepass,
      orderPremium: draft.orders.premium,
      adminFee: draft.orders.adminFee,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFields(null);
    setFlash("Rate baru sudah aktif untuk seluruh situs.");
    router.refresh();
  }

  async function handleReset() {
    setPending(true);
    setError(null);
    const result = await resetRateCard();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFields(null);
    setFlash("Rate dikembalikan ke default.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Notice tone="astra" icon={<IconWallet size={15} />} title="Satu kartu rate untuk semua Robux">
        Rate yang kamu terapkan di sini langsung menggerakkan harga Robux di seluruh situs. Perubahan
        disimpan sebagai baris RateCard baru (yang lama dinonaktifkan) dan tercatat di log audit.
      </Notice>

      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={dirty ? "warn" : "astra"} icon={<IconWallet size={13} />}>
          {dirty ? "Ada perubahan belum diterapkan" : "Rate aktif"}
        </Badge>
        <Badge tone="info" className="num">
          Cover {initialRates.card.cover} · No-cover {initialRates.card.noCover} · Fee{" "}
          {formatIDR(initialRates.orders.adminFee)}
        </Badge>
      </div>

      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Berhasil">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-ink">
            Katalog Robux · Rp per Robux bersih
          </span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RateInput
              id="rate-cover"
              label="Cover tax"
              suffix="Rp / Robux"
              value={effective.cover}
              onChange={(value) => update("cover", value)}
            />
            <RateInput
              id="rate-no-cover"
              label="No cover tax"
              suffix="Rp / Robux"
              value={effective.noCover}
              onChange={(value) => update("noCover", value)}
            />
          </div>
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-ink">
            Diskon volume (%)
          </span>
          <div className="grid grid-cols-3 gap-3">
            <RateInput
              id="rate-vol-2000"
              label="≥ 2.000"
              suffix="%"
              allowZero
              value={effective.vol2000}
              onChange={(value) => update("vol2000", value)}
            />
            <RateInput
              id="rate-vol-5000"
              label="≥ 5.000"
              suffix="%"
              allowZero
              value={effective.vol5000}
              onChange={(value) => update("vol5000", value)}
            />
            <RateInput
              id="rate-vol-10000"
              label="≥ 10.000"
              suffix="%"
              allowZero
              value={effective.vol10000}
              onChange={(value) => update("vol10000", value)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-ink">
Alur beli Robux · Rp per Robux
          </span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RateInput
              id="rate-username"
              label="Via Username"
              suffix="Rp / Robux"
              value={effective.rateUsername}
              onChange={(value) => update("rateUsername", value)}
            />
            <RateInput
              id="rate-login"
              label="Via Login"
              suffix="Rp / Robux"
              value={effective.rateLogin}
              onChange={(value) => update("rateLogin", value)}
            />
            <RateInput
              id="rate-gamepass"
              label="Via Gamepass"
              suffix="Rp / Robux"
              value={effective.rateGamepass}
              onChange={(value) => update("rateGamepass", value)}
            />
            <RateInput
              id="rate-admin-fee"
              label="Biaya admin"
              hint="Ditambahkan ke setiap pesanan flows"
              suffix="Rp / order"
              value={effective.adminFee}
              onChange={(value) => update("adminFee", value)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-ink">
            Roblox Premium · Rp per bulan
          </span>
          <RateInput
            id="rate-premium"
            label="Premium / bulan"
            hint="Harga 1 bulan; paket 3 & 12 bulan dihitung dari angka ini"
            suffix="Rp / bulan"
            value={effective.ratePremium}
            onChange={(value) => update("ratePremium", value)}
          />
        </section>
      </div>

      {draft === null ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Input tidak valid">
          Semua kolom wajib berisi angka. Tarif dan biaya harus lebih besar dari 0; diskon volume
          boleh 0–100.
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button leadingIcon={<IconCheck size={16} />} disabled={!dirty || pending} onClick={() => void applyDraft()}>
          {pending ? "Menyimpan…" : "Terapkan rate"}
        </Button>
        <Button variant="secondary" leadingIcon={<IconRefresh size={16} />} disabled={pending} onClick={() => void handleReset()}>
          Reset ke default
        </Button>
      </div>
    </div>
  );
}
