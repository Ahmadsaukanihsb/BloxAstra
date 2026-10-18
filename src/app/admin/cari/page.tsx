import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth";
import { searchAdmin, type AdminSearchOrderRow, type AdminSearchUserRow } from "@/lib/admin";
import {
  ADMIN_KINDS,
  KYC_SCOPES,
  ORDER_SCOPES,
  USER_SCOPES,
  WD_SCOPES,
  cleanQuery,
  parseKind,
  parseKycScope,
  parseOrderScope,
  parseSearchPage,
  parseUserScope,
  parseWdScope,
  rangeLabel,
  searchHref,
  type AdminKind,
  type Pager,
  type SearchQuery,
} from "@/lib/admin-search";
import { formatDateTime, formatIDR, formatNumber } from "@/lib/format";
import { UserRoleButtons } from "@/components/admin/user-role-buttons";
import { UserSuspendButtons } from "@/components/admin/user-suspend-buttons";
import { ConsoleMasthead, ListFrame, PanelSection } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/order/runtime";
import {
  IconArrowRight,
  IconFileText,
  IconReceipt,
  IconSearch,
  IconShieldCheck,
  IconUsers,
  IconWallet,
} from "@/components/ui/icons";
import type { OrderState } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pencarian admin",
  description:
    "Cari pesanan, pengguna, penarikan, dan entri jejak audit — dengan total dan halaman yang jujur.",
  robots: { index: false, follow: false },
};

/**
 * The surface the admin queues point at when they are holding less than they
 * know about.
 *
 * Server-rendered on purpose: the query lives in the URL, so a search is
 * shareable, the back button works, and every page is a real link rather than
 * client state that a refresh throws away. There is no client component here at
 * all — the form is a plain GET form and the filters are links, which also means
 * the page works before hydration.
 */
export default function AdminSearchPage(props: PageProps<"/admin/cari">) {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchContent searchParams={props.searchParams} />
    </Suspense>
  );
}

function SearchFallback() {
  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-14 w-full rounded-card" />
        <Skeleton className="h-14 w-full rounded-card" />
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-well" />
        ))}
      </div>
    </div>
  );
}

async function SearchContent({
  searchParams,
}: {
  searchParams: PageProps<"/admin/cari">["searchParams"];
}) {
  await connection();
  // The /admin layout already gates this route, but this call is not redundant:
  // a layout and its page render in parallel, so without it this component's
  // queries race the layout's redirect and real rows are streamed to the
  // response before the bounce is applied. Verified by requesting this URL with
  // no session — the order code and store name showed up in the body. Every
  // admin page that loads data does this for the same reason.
  await requireRole("admin");
  const params = await searchParams;

  const query: SearchQuery = {
    q: cleanQuery(params.q),
    kind: parseKind(params.jenis),
    orderScope: parseOrderScope(params.status),
    userScope: parseUserScope(params.peran),
    kycScope: parseKycScope(params.kyc),
    wdScope: parseWdScope(params.penarikan),
    page: parseSearchPage(params.hal),
  };

  const result = await searchAdmin(query);
  const previewingAll = query.kind === "semua";

  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <div className="flex flex-col gap-7">
        <ConsoleMasthead
          eyebrow="Pencarian · admin"
          title="Pencarian admin"
          description="Cari pesanan, pengguna, penarikan, atau jejak audit. Tanpa kata kunci, yang tampil adalah baris terbaru — dan setiap daftar menyebut totalnya sendiri, jadi tidak ada antrean yang diam-diam terpotong."
          meta={
            <span className="num text-[11px] text-ink-mute">
              Query ada di URL · bisa dibagikan dan di-refresh
            </span>
          }
          actions={
            <ButtonLink
              href="/admin"
              variant="secondary"
              size="sm"
              leadingIcon={<IconShieldCheck size={14} />}
            >
              Kembali ke panel
            </ButtonLink>
          }
        />

        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-4 p-4">
            <form action="/admin/cari" method="get" className="flex flex-col gap-3 sm:flex-row">
              {query.kind !== "semua" ? (
                <input type="hidden" name="jenis" value={query.kind} />
              ) : null}
              {query.orderScope !== "semua" ? (
                <input type="hidden" name="status" value={query.orderScope} />
              ) : null}
              {query.userScope !== "semua" ? (
                <input type="hidden" name="peran" value={query.userScope} />
              ) : null}
              {query.kycScope !== "semua" ? (
                <input type="hidden" name="kyc" value={query.kycScope} />
              ) : null}
              {query.wdScope !== "semua" ? (
                <input type="hidden" name="penarikan" value={query.wdScope} />
              ) : null}

              <label className="flex flex-1 items-center gap-2.5 rounded-control bg-canvas px-4 py-3 outline outline-1 -outline-offset-1 outline-line transition-[outline-color] duration-200 focus-within:outline-2 focus-within:outline-astra/70">
                <IconSearch size={16} className="shrink-0 text-ink-mute" />
                <input
                  name="q"
                  defaultValue={query.q}
                  autoComplete="off"
                  placeholder="BX-9F0C18, username, email, toko, ref penarikan…"
                  aria-label="Kata kunci pencarian admin"
                  className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-mute"
                />
              </label>
              <Button type="submit" className="sm:w-auto">
                Cari
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-4">
              <span className="mr-1.5 tag text-ink-mute">Jenis</span>
              {ADMIN_KINDS.map((kind) => (
                <FilterChip
                  key={kind.id}
                  href={searchHref({ ...query, kind: kind.id, page: 1 })}
                  active={query.kind === kind.id}
                  label={kind.label}
                />
              ))}
            </div>

            {query.kind === "pesanan" ? (
              <ChipRow
                label="Status pesanan"
                chips={ORDER_SCOPES.map((scope) => ({
                  key: scope.id,
                  label: scope.label,
                  href: searchHref({ ...query, orderScope: scope.id, page: 1 }),
                  active: query.orderScope === scope.id,
                }))}
              />
            ) : null}

            {query.kind === "pengguna" ? (
              <div className="flex flex-col gap-2.5">
                <ChipRow
                  label="Peran"
                  chips={USER_SCOPES.map((scope) => ({
                    key: scope.id,
                    label: scope.label,
                    href: searchHref({ ...query, userScope: scope.id, page: 1 }),
                    active: query.userScope === scope.id,
                  }))}
                />
                <ChipRow
                  label="KYC"
                  chips={KYC_SCOPES.map((scope) => ({
                    key: scope.id,
                    label: scope.label,
                    href: searchHref({ ...query, kycScope: scope.id, page: 1 }),
                    active: query.kycScope === scope.id,
                  }))}
                />
              </div>
            ) : null}

            {query.kind === "penarikan" ? (
              <ChipRow
                label="Status penarikan"
                chips={WD_SCOPES.map((scope) => ({
                  key: scope.id,
                  label: scope.label,
                  href: searchHref({ ...query, wdScope: scope.id, page: 1 }),
                  active: query.wdScope === scope.id,
                }))}
              />
            ) : null}
          </div>
        </div>

        {/* Orders */}
        {result.orders ? (
          <Section
            title="Pesanan"
            hint={`${formatNumber(result.orders.pager.total)} cocok`}
            pager={result.orders.pager}
            query={query}
            kind="pesanan"
            previewingAll={previewingAll}
            icon={<IconReceipt size={15} />}
            empty="Tidak ada pesanan yang cocok. Coba kode pesanan penuh (BX-XXXXXX), username pembeli, atau nama toko penjual."
          >
            {result.orders.rows.map((row) => (
              <OrderRow key={row.code} row={row} />
            ))}
          </Section>
        ) : null}

        {/* Users */}
        {result.users ? (
          <Section
            title="Pengguna"
            hint={`${formatNumber(result.users.pager.total)} cocok`}
            pager={result.users.pager}
            query={query}
            kind="pengguna"
            previewingAll={previewingAll}
            icon={<IconUsers size={15} />}
            empty="Tidak ada pengguna yang cocok. Coba username, email, nomor WhatsApp, atau nama toko."
          >
            {result.users.rows.map((row) => (
              <UserRow key={row.id} row={row} query={query} />
            ))}
          </Section>
        ) : null}

        {/* Withdrawals */}
        {result.withdrawals ? (
          <Section
            title="Penarikan"
            hint={`${formatNumber(result.withdrawals.pager.total)} cocok`}
            pager={result.withdrawals.pager}
            query={query}
            kind="penarikan"
            previewingAll={previewingAll}
            icon={<IconWallet size={15} />}
            empty="Tidak ada penarikan yang cocok. Coba ref (WD-XXXX), nama bank, nomor rekening, atau nama toko."
          >
            {result.withdrawals.rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-200 hover:bg-canvas-2/60"
              >
                <WithdrawalStatus status={row.status} />
                <span className="num text-[13px] font-bold text-ink">{row.ref}</span>
                <span className="min-w-[140px] flex-1 truncate text-[12px] text-ink-dim">
                  {row.storeName}
                </span>
                <span className="num text-[11px] text-ink-mute">
                  {row.bank} · {row.accountNumber}
                </span>
                <span className="price text-[13px] leading-none text-astra-ink">
                  {formatIDR(row.amount)}
                </span>
                <span className="num text-[11px] text-ink-mute">biaya {formatIDR(row.fee)}</span>
                <span className="num text-[11px] text-ink-mute">
                  {formatDateTime(row.createdAt)}
                </span>
              </div>
            ))}
          </Section>
        ) : null}

        {/* Audit trail */}
        {result.audit ? (
          <Section
            title="Jejak audit"
            hint={`${formatNumber(result.audit.pager.total)} cocok`}
            pager={result.audit.pager}
            query={query}
            kind="audit"
            previewingAll={previewingAll}
            icon={<IconFileText size={15} />}
            empty="Tidak ada entri audit yang cocok. Coba jenis aksi, nama aktor, atau id target."
          >
            {result.audit.rows.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors duration-200 hover:bg-canvas-2/60"
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
                </div>
              </div>
            ))}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

/** One result block: a labelled total, its rows, and the way to the rest. */
function Section({
  title,
  hint,
  pager,
  query,
  kind,
  previewingAll,
  icon,
  empty,
  children,
}: {
  title: string;
  hint: string;
  pager: Pager;
  query: SearchQuery;
  kind: Exclude<AdminKind, "semua">;
  previewingAll: boolean;
  icon: ReactNode;
  empty: string;
  children: ReactNode;
}) {
  const emptySection = pager.total === 0;

  return (
    <PanelSection
      title={title}
      hint={hint}
      action={
        /* A preview shows the newest few and one door to the full, paged list.
           Paging a five-row preview would be pretend pagination. */
        previewingAll && !emptySection ? (
          <Link
            href={searchHref({ ...query, kind, page: 1 })}
            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-astra-ink transition-colors duration-300 hover:text-ink"
          >
            Lihat semua {title.toLowerCase()}
            <IconArrowRight size={13} />
          </Link>
        ) : null
      }
    >
      {emptySection ? (
        <EmptyState icon={icon} title={`Tidak ada ${title.toLowerCase()}`} description={empty} />
      ) : (
        <>
          <ListFrame>{children}</ListFrame>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="num text-[11px] text-ink-mute">{rangeLabel(pager)}</span>
            {/* No pager while previewing every kind at once: those sections hold
                five rows, and paging them would jump the admin into a different
                page size mid-list. The preview offers one door instead — "Lihat
                semua" — which lands on page 1 of the full set. */}
            {!previewingAll && pager.pageCount > 1 ? (
              <div className="flex items-center gap-2.5">
                {pager.hasPrev ? (
                  <ButtonLink
                    href={searchHref({ ...query, kind, page: pager.page - 1 })}
                    variant="secondary"
                    size="sm"
                  >
                    Sebelumnya
                  </ButtonLink>
                ) : (
                  <Button variant="secondary" size="sm" disabled>
                    Sebelumnya
                  </Button>
                )}
                <span className="num text-[11px] text-ink-mute">
                  Halaman {pager.page} / {pager.pageCount}
                </span>
                {pager.hasNext ? (
                  <ButtonLink
                    href={searchHref({ ...query, kind, page: pager.page + 1 })}
                    variant="secondary"
                    size="sm"
                  >
                    Berikutnya
                  </ButtonLink>
                ) : (
                  <Button variant="secondary" size="sm" disabled>
                    Berikutnya
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </PanelSection>
  );
}

function ChipRow({
  label,
  chips,
}: {
  label: string;
  chips: { key: string; label: string; href: string; active: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1.5 tag text-ink-mute">{label}</span>
      {chips.map((chip) => (
        <FilterChip key={chip.key} href={chip.href} active={chip.active} label={chip.label} />
      ))}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "rounded-full bg-astra px-3 py-1.5 text-[11px] font-bold text-white transition-colors duration-300"
          : "rounded-full bg-canvas px-3 py-1.5 text-[11px] font-bold text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}

function OrderRow({ row }: { row: AdminSearchOrderRow }) {
  return (
    <Link
      href={`/pesanan/${row.code}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-200 hover:bg-canvas-2/60"
    >
      <StatusPill state={row.status as OrderState} />
      <span className="num text-[13px] font-bold text-ink">{row.code}</span>
      <span className="min-w-[140px] flex-1 truncate text-[12px] text-ink-dim">{orderTitle(row)}</span>
      <span className="text-[11px] text-ink-mute">
        {row.buyerUsername} → {row.sellerStoreName ?? "antrean pool"}
      </span>
      <span className="price text-[13px] leading-none text-astra-ink">{formatIDR(row.total)}</span>
      <span className="num text-[11px] text-ink-mute">{formatDateTime(row.createdAt)}</span>
    </Link>
  );
}

/**
 * A user row has no detail page to link to, so the useful action is a pivot:
 * the same search, narrowed to the orders this user is part of. That is what an
 * admin actually wants next after finding a name.
 */
function UserRow({ row, query }: { row: AdminSearchUserRow; query: SearchQuery }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-200 hover:bg-canvas-2/60">
      <RoleBadge role={row.role} />
      <span className="num text-[13px] font-bold text-ink">{row.username}</span>
      <span className="min-w-[160px] flex-1 truncate text-[12px] text-ink-dim">{row.email}</span>
      <span className="num text-[11px] text-ink-mute">
        {row.storeName ? `${row.storeName}${row.tier ? ` · tier ${row.tier}` : ""}` : "tanpa toko"}
      </span>
      <span className="num text-[11px] text-ink-mute">{formatNumber(row.orderCount)} pesanan</span>
      <KycBadge status={row.kycStatus} verifiedPhone={row.whatsappVerified} />
      <span className="num text-[11px] text-ink-mute">{formatDateTime(row.joinedAt)}</span>
      <Link
        href={searchHref({ ...query, kind: "pesanan", q: row.username, page: 1 })}
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-astra-ink transition-colors duration-300 hover:text-ink"
      >
        Pesanannya
        <IconArrowRight size={12} />
      </Link>
      <UserRoleButtons
        userId={row.id}
        username={row.username}
        role={row.role}
        suspended={row.suspended}
      />
      <UserSuspendButtons
        userId={row.id}
        username={row.username}
        role={row.role}
        suspended={row.suspended}
        suspendReason={row.suspendReason}
      />
    </div>
  );
}

function orderTitle(row: AdminSearchOrderRow): string {
  if (row.productTitle) return row.productTitle;
  if (row.kind === "premium") return "Roblox Premium";
  if (row.robuxAmount && row.kind.startsWith("robux")) {
    return `${formatNumber(row.robuxAmount)} Robux${row.robloxUsername ? ` · ${row.robloxUsername}` : ""}`;
  }
  return row.kind === "catalog" ? "Pesanan katalog" : row.kind;
}

function RoleBadge({ role }: { role: string }) {
  const tone = role === "admin" ? "astra" : role === "seller" ? "robux" : "neutral";
  return <Badge tone={tone}>{role}</Badge>;
}

function KycBadge({ status, verifiedPhone }: { status: string; verifiedPhone: boolean }) {
  if (status === "verified") {
    return (
      <Badge tone="success">
        KYC verified{verifiedPhone ? " · WA terverifikasi" : ""}
      </Badge>
    );
  }
  if (status === "pending") return <Badge tone="warn">KYC menunggu</Badge>;
  if (status === "rejected") return <Badge tone="danger">KYC ditolak</Badge>;
  return <Badge tone="neutral">KYC {status}</Badge>;
}

function WithdrawalStatus({ status }: { status: string }) {
  if (status === "paid") return <Badge tone="success">cair</Badge>;
  if (status === "rejected") return <Badge tone="danger">ditolak</Badge>;
  return <Badge tone="warn">menunggu</Badge>;
}
