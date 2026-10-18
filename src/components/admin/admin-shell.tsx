"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  resolveDispute,
  releaseEscrow,
  updateRateCard,
  resetRateCard,
  approveWithdrawal,
  rejectWithdrawal,
} from "@/app/actions/admin";
import type {
  AdminDisputeRow,
  AdminEscrowRow,
  AdminAuditRow,
  AdminWithdrawalRow,
  AdminKycRow,
  AdminReviewRow,
  AdminUserRow,
  AdminProductRow,
  AdminPromoRow,
  AdminTopUpRow,
  ChatReportRow,
} from "@/lib/admin";
import { blogUrl } from "@/lib/site";
import type { LandingLayout } from "@/lib/landing-sections";
import type { BlogPostAdminRow } from "@/lib/blog";
import { DISPUTE_SELLER_REPLIED_STATE } from "@/lib/order-meta";
import type { RobuxOrderRates } from "@/lib/robux-orders";
import type { RateCard } from "@/lib/robux-pricing";
import type { ServiceArt } from "@/lib/service-art-slots";
import type { SitePopup, SitePromo } from "@/lib/site-notice-slots";
import { ServiceArtEditor } from "@/components/admin/service-art-editor";
import { PlusEligibility } from "@/components/admin/plus-eligibility";
import { ProductsPanel } from "@/components/admin/admin-products";
import { PromosPanel } from "@/components/admin/admin-promos";
import { SettingsPanel, type AdminSettingsInitial } from "@/components/admin/admin-settings";
import { TopUpsPanel } from "@/components/admin/admin-topups";
import { ReportsPanel } from "@/components/admin/admin-reports";
import { LogoPanel } from "@/components/admin/admin-logo";
import { NoticePanel } from "@/components/admin/admin-notice";
import { SocialPanel } from "@/components/admin/admin-social";
import type { SocialLinks } from "@/lib/social-links-slots";
import { BlogPanel } from "@/components/admin/admin-blog";
import { LandingPanel } from "@/components/admin/admin-landing";
import { KycQueue } from "@/components/admin/kyc-queue";
import { UsersPanel } from "@/components/admin/admin-users";
import { ReviewsPanel } from "@/components/admin/admin-reviews";
import { EvidenceGallery } from "@/components/order/dispute-evidence";
import {
  ConsoleMasthead,
  KpiTile,
  ListFrame,
  PanelSection,
  RecordFrame,
} from "@/components/admin/console";
import { formatDateTime, formatIDR } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/field";
import { ProductArt } from "@/components/ui/art";
import { StatRow } from "@/components/ui/surface";
import { StatusPill } from "@/components/order/runtime";
import {
  IconAlert,
  IconChat,
  IconCheck,
  IconEye,
  IconFileText,
  IconRefresh,
  IconScale,
  IconSearch,
  IconShieldCheck,
  IconWallet,
} from "@/components/ui/icons";

type Tab = "sengketa" | "escrow" | "tarik" | "rate" | "kartu" | "plus" | "audit" | "produk" | "promo" | "pengaturan" | "topup" | "laporan" | "logo" | "beranda" | "notifikasi" | "sosial" | "blog" | "kyc" | "pengguna" | "ulasan";

/**
 * Tabs live in groups because seventeen flat entries read as a wall. Groups
 * follow the work, not the data model: queues that need a decision first,
 * then the catalogue, the people, the storefront, the machinery.
 */
const TAB_GROUPS: { label: string; tabs: { id: Tab; label: string }[] }[] = [
  {
    label: "Antrean",
    tabs: [
      { id: "sengketa", label: "Sengketa" },
      { id: "escrow", label: "Escrow" },
      { id: "tarik", label: "Penarikan" },
      { id: "kyc", label: "KYC" },
      { id: "topup", label: "Top-up" },
      { id: "laporan", label: "Laporan" },
    ],
  },
  {
    label: "Katalog",
    tabs: [
      { id: "produk", label: "Produk" },
      { id: "promo", label: "Promo" },
      { id: "rate", label: "Rate Robux" },
      { id: "kartu", label: "Gambar kartu" },
      { id: "plus", label: "Cek Plus" },
    ],
  },
  {
    label: "Pengguna",
    tabs: [
      { id: "pengguna", label: "Pengguna" },
      { id: "ulasan", label: "Ulasan" },
    ],
  },
  {
    label: "Konten situs",
    tabs: [
      { id: "beranda", label: "Beranda" },
      { id: "notifikasi", label: "Notifikasi" },
      { id: "sosial", label: "Sosial media" },
      { id: "blog", label: "Blog" },
      { id: "logo", label: "Logo & favicon" },
    ],
  },
  {
    label: "Sistem",
    tabs: [
      { id: "pengaturan", label: "Pengaturan" },
      { id: "audit", label: "Jejak audit" },
    ],
  },
];

const ALL_TABS = new Set<Tab>(TAB_GROUPS.flatMap((group) => group.tabs.map((item) => item.id)));

const RBAC: { action: string; allowed: boolean }[] = [
  { action: "Arbitrase mediasi sengketa", allowed: true },
  { action: "Eksekusi manual payout", allowed: true },
  { action: "Takedown & sorotan produk", allowed: true },
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
  initialServiceArt,
  initialProducts,
  initialPromos,
  initialSettings,
  initialTopUps,
  initialReports,
  initialLogo,
  initialFavicon,
  initialPromo,
  initialPopup,
  initialSocial,
  initialLanding,
  initialBlogPosts,
  initialKyc,
  initialUsers,
  suspendedCount,
  initialReviews,
  adminName,
  adminEmail,
  totals,
}: {
  initialDisputes: AdminDisputeRow[];
  initialEscrow: AdminEscrowRow[];
  initialWithdrawals: AdminWithdrawalRow[];
  initialAuditLogs: AdminAuditRow[];
  initialRates: InitialRates;
  initialServiceArt: ServiceArt;
  initialProducts: AdminProductRow[];
  initialPromos: AdminPromoRow[];
  initialSettings: AdminSettingsInitial;
  initialTopUps: AdminTopUpRow[];
  initialReports: ChatReportRow[];
  initialLogo: string | null;
  initialFavicon: string | null;
  initialPromo: SitePromo;
  initialPopup: SitePopup;
  initialSocial: SocialLinks;
  initialLanding: LandingLayout;
  initialBlogPosts: BlogPostAdminRow[];
  initialKyc: { rows: AdminKycRow[]; total: number };
  initialUsers: AdminUserRow[];
  suspendedCount: number;
  initialReviews: AdminReviewRow[];
  adminName: string;
  adminEmail: string;
  totals: {
    heldTotal: number;
    escrowCount: number;
    openDisputeCount: number;
    pendingWithdrawalCount: number;
    auditTotal: number;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    paramTab && ALL_TABS.has(paramTab as Tab) ? (paramTab as Tab) : "sengketa",
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
  const stats: {
    label: string;
    value: string;
    hint: string;
    tone: "astra" | "danger" | "warn" | "robux" | "neutral";
    go?: Tab;
    href?: string;
  }[] = [
    {
      label: "Dana ditahan escrow",
      value: formatIDR(heldTotal),
      hint: "Dibekukan sampai pesanan selesai",
      tone: "astra",
      go: "escrow",
    },
    {
      label: "Sengketa menunggu putusan",
      value: String(totals.openDisputeCount),
      hint: totals.openDisputeCount > 0 ? "Butuh putusan admin" : "SLA mediasi terpenuhi",
      tone: totals.openDisputeCount > 0 ? "danger" : "neutral",
      go: "sengketa",
    },
    {
      label: "Pesanan dalam escrow",
      value: String(totals.escrowCount),
      hint: "Menunggu pencairan",
      tone: "robux",
      go: "escrow",
    },
    {
      label: "Penarikan menunggu",
      value: String(totals.pendingWithdrawalCount),
      hint: "Saldo penjual",
      tone: totals.pendingWithdrawalCount > 0 ? "warn" : "neutral",
      go: "tarik",
    },
    // The real size of the trail, not the length of the fetched page — this used
    // to print `logs.length`, so past 50 entries the panel reported a number
    // that was really just its own page size.
    {
      label: "Entri jejak audit",
      value: String(totals.auditTotal),
      hint: "Semua aksi tercatat",
      tone: "neutral",
      href: "/admin/cari?jenis=audit",
    },
  ];

  // What the server held for each queue when this page was fetched, against what
  // the page actually carries. Read from the initial props rather than live
  // state: after resolving a dispute the list is shorter on purpose, and the
  // notice is about the fetch, not about the admin's own progress.
  const fetched = {
    sengketa: { shown: initialDisputes.length, total: totals.openDisputeCount },
    escrow: { shown: initialEscrow.length, total: totals.escrowCount },
    tarik: { shown: initialWithdrawals.length, total: totals.pendingWithdrawalCount },
    audit: { shown: initialAuditLogs.length, total: totals.auditTotal },
  } as const;
  const active = fetched[tab as keyof typeof fetched];
  const truncated = active && active.shown < active.total ? active : null;
  const truncatedHref = {
    sengketa: "/admin/cari?jenis=pesanan&status=sengketa",
    escrow: "/admin/cari?jenis=pesanan&status=escrow",
    tarik: "/admin/cari?jenis=penarikan&penarikan=pending",
    audit: "/admin/cari?jenis=audit",
  }[tab as keyof typeof fetched];

  const tabCount: Partial<Record<Tab, number>> = {
    sengketa: disputes.length,
    tarik: withdrawals.length,
    escrow: escrow.length,
    // Snapshot counts — the panels mutate their own lists after each action,
    // and a full refresh re-syncs the badges.
    topup: initialTopUps.length,
    laporan: initialReports.length,
    kyc: initialKyc.total,
  };

  const panel: { title: string; hint: string; description: string; action?: ReactNode } = {
    sengketa: {
      title: "Antrean sengketa",
      hint: `${disputes.length} kasus di layar`,
      description:
        "Setiap putusan refund atau pencairan langsung tercatat di admin_audit_logs. Putusan hanya sah untuk pesanan yang benar-benar berstatus disputed.",
      action: (
        <ButtonLink
          href="/admin/cari?jenis=pesanan&status=sengketa"
          variant="secondary"
          size="sm"
          leadingIcon={<IconSearch size={14} />}
        >
          Semua sengketa
        </ButtonLink>
      ),
    },
    escrow: {
      title: "Escrow & pencairan",
      hint: `${escrow.length} pesanan di layar`,
      description:
        "Dana yang masih ditahan platform. Pesanan yang sedang disengketakan dibekukan dan hanya bisa diputuskan dari antrean sengketa.",
      action: (
        <ButtonLink
          href="/admin/cari?jenis=pesanan&status=escrow"
          variant="secondary"
          size="sm"
          leadingIcon={<IconSearch size={14} />}
        >
          Semua pesanan escrow
        </ButtonLink>
      ),
    },
    tarik: {
      title: "Penarikan penjual",
      hint: `${withdrawals.length} pengajuan di layar`,
      description:
        "Saldo sudah dipotong sejak penjual mengajukan. Menyetujui menandai dana terkirim; menolak mengembalikan amount + biaya ke dompet penjual.",
      action: (
        <ButtonLink
          href="/admin/cari?jenis=penarikan&penarikan=pending"
          variant="secondary"
          size="sm"
          leadingIcon={<IconSearch size={14} />}
        >
          Semua penarikan
        </ButtonLink>
      ),
    },
    rate: {
      title: "Rate Robux",
      hint: "Berlaku untuk seluruh situs",
      description:
        "Rate yang diterapkan di sini langsung menggerakkan harga di katalog dan di semua alur beli Robux. Perubahan disimpan sebagai baris RateCard baru dan tercatat di log audit.",
    },
    kartu: {
      title: "Gambar kartu beranda",
      hint: "Empat slot metode",
      description:
        "Gambar khusus untuk empat kartu metode di beranda. Kosongkan satu slot untuk memakai ikon bawaan lagi.",
    },
    plus: {
      title: "Cek kelayakan trial Plus",
      hint: "Membaca, bukan mengklaim",
      description:
        "Membaca sinyal langsung dari akun Roblox pelanggan lewat rute web yang memang cookie-authenticated. Klaim trial tetap dilakukan manual di browser yang sudah login, dan biaya trial ditanggung PayPal pelanggan.",
    },
    audit: {
      title: "Jejak audit",
      hint: `${logs.length} entri terbaru`,
      description:
        "Riwayat aksi admin: sengketa, pencairan, penarikan, rate, dan KYC. Diff disimpan apa adanya agar bisa diperiksa ulang.",
      action: (
        <ButtonLink
          href="/admin/cari?jenis=audit"
          variant="secondary"
          size="sm"
          leadingIcon={<IconSearch size={14} />}
        >
          Semua entri audit
        </ButtonLink>
      ),
    },
    produk: {
      title: "Moderasi produk",
      hint: `${initialProducts.length} listing terbaru`,
      description:
        "Turunkan listing bermasalah tanpa menghapusnya — pesanan berjalan tidak terganggu. Sorotan menaruh listing di rak beranda.",
    },
    promo: {
      title: "Kode promo",
      hint: `${initialPromos.length} kode`,
      description:
        "Buat, matikan, atau hapus kode promo. Kode yang sudah pernah dipakai tidak bisa dihapus — matikan saja.",
    },
    pengaturan: {
      title: "Pengaturan platform",
      hint: "Biaya, bank & sweep",
      description:
        "Nilai yang sebelumnya hanya bisa diubah lewat database. Setiap penyimpanan tercatat di log audit.",
    },
    topup: {
      title: "Top-up menggantung",
      hint: `${initialTopUps.length} antre`,
      description:
        "Top-up pending, gagal, atau kedaluwarsa yang belum dikreditkan. Kreditkan manual hanya setelah dana diverifikasi di luar sistem.",
    },
    laporan: {
      title: "Laporan chat seller",
      hint: `${initialReports.length} laporan`,
      description:
        "Pesan grup seller yang dilaporkan. Hapus pesannya (soft delete) atau abaikan laporannya.",
    },
    logo: {
      title: "Logo & favicon",
      hint: initialLogo || initialFavicon ? "Kustom aktif" : "Bawaan",
      description:
        "Logo header, footer, dashboard, dan halaman masuk — plus ikon tab browser (favicon). Dikosongkan = kembali ke mark bawaan.",
    },
    beranda: {
      title: "Susunan beranda",
      hint: "Urutan & visibilitas",
      description:
        "Atur section beranda mau di atas atau di bawah, dan sembunyikan yang tidak perlu. Hero selalu paling atas.",
    },
    notifikasi: {
      title: "Notifikasi situs",
      hint: "Bilah atas & pop up beranda",
      description:
        "Bilah promo di paling atas situs dan pop up yang muncul saat pengunjung baru membuka beranda. Teks, tombol, tautan, dan gambar bisa diubah — atau dimatikan — kapan saja tanpa deploy.",
    },
    sosial: {
      title: "Sosial media footer",
      hint: "Discord, Instagram, WhatsApp, dll.",
      description:
        "Tautan sosial yang muncul sebagai ikon di footer semua halaman. Satu URL per platform — kosongkan baris untuk menyembunyikan ikonnya. Hanya URL https di domain resmi platform yang diterima.",
    },
    blog: {
      title: "Blog",
      hint: `${initialBlogPosts.length} artikel`,
      description:
        "Artikel publik di blog.bloxastra.com. Yang terbit muncul di index, masuk sitemap, dan bisa ditemukan mesin pencari — tulis untuk kata kunci yang dicari calon pembeli Robux. Draf hanya tampak di panel ini.",
      action: (
        <ButtonLink
          href={blogUrl("/")}
          variant="secondary"
          size="sm"
          leadingIcon={<IconEye size={14} />}
        >
          Buka blog
        </ButtonLink>
      ),
    },
    kyc: {
      title: "Antrean KYC penjual",
      hint: `${initialKyc.total} menunggu`,
      description:
        "Verifikasi identitas penjual baru. Menyetujui menandai akun & toko terverifikasi; menolak mengembalikan pengajuan dengan alasan.",
    },
    pengguna: {
      title: "Moderasi pengguna",
      hint: suspendedCount > 0 ? `${suspendedCount} ditangguhkan` : "Tidak ada penangguhan",
      description:
        "Tangguhkan akun bermasalah (sesi dan login langsung terkunci) atau pulihkan yang sudah selesai. Akun admin hanya lewat database.",
    },
    ulasan: {
      title: "Moderasi ulasan",
      hint: `${initialReviews.length} terbaru`,
      description:
        "Sembunyikan komentar bermasalah dari publik (beranda, halaman produk, agregat rating) atau tampilkan kembali. Tidak ada yang dihapus permanen.",
    },
  }[tab];

  return (
    <div className="flex flex-col gap-5">
      <ConsoleMasthead
        dense
        eyebrow="Operasional"
        title="Panel admin"
        meta={
          <Badge tone="astra" icon={<IconShieldCheck size={13} />}>
            {adminName || adminEmail} · admin
          </Badge>
        }
        actions={
          <>
            <ButtonLink
              href="/admin/cari"
              variant="secondary"
              size="sm"
              leadingIcon={<IconSearch size={14} />}
            >
              Cari pesanan, pengguna, penarikan
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <KpiTile
            key={stat.label}
            dense
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
            tone={stat.tone}
            href={stat.href}
            active={stat.go === tab}
            onClick={stat.go ? () => setTab(stat.go as Tab) : undefined}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav
        aria-label="Bagian panel admin"
        className="bezel-shell overflow-hidden p-1.5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-15rem)] lg:overflow-y-auto"
      >
        <div className="no-scrollbar bezel-core flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TAB_GROUPS.map((group, groupIndex) => (
            <div
              key={group.label}
              className={cx(
                "flex shrink-0 gap-1 lg:w-full lg:flex-col",
                groupIndex > 0 && "lg:mt-2 lg:border-t lg:border-line lg:pt-2",
              )}
            >
              <span className="flex shrink-0 items-center px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-mute lg:px-3.5 lg:pt-1 lg:pb-0.5">
                {group.label}
              </span>
              {group.tabs.map((item) => {
                const isActive = tab === item.id;
                const count = tabCount[item.id] ?? 0;
                const countTone =
                  item.id === "sengketa" || item.id === "laporan" || item.id === "kyc"
                    ? "bg-danger/15 text-danger"
                    : item.id === "tarik" || item.id === "topup"
                      ? "bg-warn/15 text-warn"
                      : "bg-canvas text-ink-mute";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cx(
                      "flex shrink-0 items-center gap-2 rounded-well px-3.5 py-2.5 text-[12px] font-bold transition-[background-color,color] duration-300 ease-[var(--ease-astra)] lg:w-full",
                      isActive
                        ? "bg-astra text-white"
                        : "text-ink-dim hover:bg-canvas-2 hover:text-ink",
                    )}
                  >
                    {item.label}
                    {count > 0 ? (
                      <span
                        className={cx(
                          "num rounded-full px-1.5 py-0.5 text-[10px] font-extrabold lg:ml-auto",
                          // The active tab is solid crimson, so the tone-coloured
                          // badge would sink into it. On crimson, invert to a light chip.
                          isActive ? "bg-paper/25 text-white" : countTone,
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Site-side doors the dashboard rail used to carry on /admin. The
              console is standalone now, so these travel with its own nav —
              including Keluar, which must stay reachable without a rail. */}
          <div className="flex shrink-0 gap-1 lg:mt-2 lg:w-full lg:flex-col lg:border-t lg:border-line lg:pt-2">
            <span className="flex shrink-0 items-center px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-mute lg:px-3.5 lg:pt-1 lg:pb-0.5">
              Situs
            </span>
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 rounded-well px-3.5 py-2.5 text-[12px] font-bold text-ink-dim transition-[background-color,color] duration-300 ease-[var(--ease-astra)] hover:bg-canvas-2 hover:text-ink lg:w-full"
            >
              Beranda
            </Link>
            <Link
              href="/dashboard/penjual"
              className="flex shrink-0 items-center gap-2 rounded-well px-3.5 py-2.5 text-[12px] font-bold text-ink-dim transition-[background-color,color] duration-300 ease-[var(--ease-astra)] hover:bg-canvas-2 hover:text-ink lg:w-full"
            >
              Preview penjual
            </Link>
            <a
              href="/api/auth/logout"
              className="flex shrink-0 items-center gap-2 rounded-well px-3.5 py-2.5 text-[12px] font-bold text-danger transition-[background-color,color] duration-300 ease-[var(--ease-astra)] hover:bg-danger/[0.07] lg:w-full"
            >
              Keluar
            </a>
          </div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-col gap-6">
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tercatat di admin_audit_logs">
          {flash}
        </Notice>
      ) : null}

      {truncated && truncatedHref ? (
        <Notice tone="warn" icon={<IconAlert size={15} />} title="Daftar ini tidak memuat semuanya">
          <span className="flex flex-col gap-2.5">
            <span>
              Halaman ini membawa {truncated.shown} baris, sementara server menyimpan{" "}
              {truncated.total}. Sisanya bisa ditelusuri 20 baris sekaligus di pencarian admin —
              lengkap dengan total dan nomor halaman.
            </span>
            <ButtonLink href={truncatedHref} variant="secondary" size="sm" className="w-fit">
              Buka daftar lengkap
            </ButtonLink>
          </span>
        </Notice>
      ) : null}

      <PanelSection
        title={panel.title}
        hint={panel.hint}
        description={panel.description}
        action={panel.action}
      >
        {tab === "sengketa" ? <DisputeQueue orders={disputes} onResolve={handleResolve} /> : null}
        {tab === "produk" ? <ProductsPanel initial={initialProducts} /> : null}
        {tab === "promo" ? <PromosPanel initial={initialPromos} /> : null}
        {tab === "pengaturan" ? <SettingsPanel initial={initialSettings} /> : null}
        {tab === "topup" ? <TopUpsPanel initial={initialTopUps} /> : null}
        {tab === "laporan" ? <ReportsPanel initial={initialReports} /> : null}
        {tab === "logo" ? <LogoPanel initial={initialLogo} initialFavicon={initialFavicon} /> : null}
        {tab === "notifikasi" ? (
          <NoticePanel initialPromo={initialPromo} initialPopup={initialPopup} />
        ) : null}
        {tab === "sosial" ? <SocialPanel initial={initialSocial} /> : null}
        {tab === "blog" ? <BlogPanel initial={initialBlogPosts} /> : null}
        {tab === "beranda" ? <LandingPanel initial={initialLanding} /> : null}
        {tab === "kyc" ? <KycQueue rows={initialKyc.rows} total={initialKyc.total} /> : null}
        {tab === "pengguna" ? <UsersPanel initial={initialUsers} suspendedCount={suspendedCount} /> : null}
        {tab === "ulasan" ? <ReviewsPanel initial={initialReviews} /> : null}
        {tab === "escrow" ? (
          <EscrowLedger
            orders={escrow}
            onRelease={handleRelease}
            onDecide={() => setTab("sengketa")}
          />
        ) : null}
        {tab === "tarik" ? (
          <WithdrawalQueue
            rows={withdrawals}
            onApprove={handleApproveWithdrawal}
            onReject={handleRejectWithdrawal}
          />
        ) : null}
        {tab === "rate" ? <RateRobuxEditor initialRates={initialRates} /> : null}
        {tab === "kartu" ? <ServiceArtEditor initialArt={initialServiceArt} /> : null}
        {tab === "plus" ? <PlusEligibility /> : null}
        {tab === "audit" ? <AuditLog logs={logs} /> : null}
      </PanelSection>
      </div>
      </div>
    </div>
  );
}

/* ─── Sengketa ─── */

const SLA_TOTAL_HOURS = 24;

function slaBarClass(hours: number): string {
  if (hours <= 6) return "bg-danger";
  if (hours <= 12) return "bg-warn";
  return "bg-success";
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
    <div className="flex flex-col gap-3.5">
      {orders.map((order) => {
        const slaPercent = Math.min(
          100,
          Math.max(4, (order.dispute.slaHoursLeft / SLA_TOTAL_HOURS) * 100),
        );
        return (
          <RecordFrame key={order.orderId} tone="danger">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusPill state={order.state} />
              <Badge tone="danger" icon={<IconScale size={13} />}>
                {order.dispute.ref}
              </Badge>
              <Badge tone="warn">{order.dispute.reasonLabel}</Badge>
              {order.dispute.status === DISPUTE_SELLER_REPLIED_STATE ? (
                <Badge tone="info" icon={<IconChat size={13} />}>
                  Penjual sudah membalas
                </Badge>
              ) : null}
              <span className="ml-auto flex items-center gap-2.5">
                <span className="num text-[11px] text-ink-mute">
                  Sisa waktu putusan {order.dispute.slaHoursLeft} jam
                </span>
                <span aria-hidden className="h-1 w-20 overflow-hidden rounded-full bg-canvas-2">
                  <span
                    className={cx("block h-full rounded-full", slaBarClass(order.dispute.slaHoursLeft))}
                    style={{ width: `${slaPercent}%` }}
                  />
                </span>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <ProductArt
                seed={order.productSlug || order.code}
                category="item"
                className="size-14 shrink-0 rounded-well"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-extrabold text-ink">
                  {order.productTitle}
                </span>
                <span className="num truncate text-[11px] text-ink-mute">
                  {order.code} · {order.sellerStoreName} · dibuka{" "}
                  {formatDateTime(order.dispute.openedAt)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-well bg-canvas-2 p-4">
                <span className="eyebrow text-ink-mute">Keluhan pembeli</span>
                <p className="text-[13px] leading-relaxed text-ink-dim">{order.dispute.buyerNote}</p>
              </div>
              <div className="flex flex-col gap-2 rounded-well bg-canvas-2 p-4">
                <span className="eyebrow text-ink-mute">Tanggapan penjual</span>
                <p className="text-[13px] leading-relaxed text-ink-dim">
                  {order.dispute.sellerReply || "—"}
                </p>
              </div>
            </div>

            {order.dispute.evidence.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 eyebrow text-ink-mute">
                  <IconFileText size={13} /> Bukti terlampir ({order.dispute.evidence.length})
                </span>
                <EvidenceGallery items={order.dispute.evidence} />
              </div>
            ) : null}

            <div className="flex flex-col gap-4 border-t border-line pt-4">
              <div className="grid grid-cols-1 gap-3 rounded-well bg-canvas-2 p-4 sm:grid-cols-3">
                <StatRow label="Nilai pesanan" value={formatIDR(order.total)} tone="astra" />
                <StatRow label="Biaya platform" value={formatIDR(order.platformFee)} />
                <StatRow label="Status escrow" value="Dana dibekukan" tone="danger" />
              </div>

              <div className="flex flex-wrap gap-2.5">
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
          </RecordFrame>
        );
      })}
    </div>
  );
}

/* ─── Escrow ─── */

function EscrowLedger({
  orders,
  onRelease,
  onDecide,
}: {
  orders: AdminEscrowRow[];
  onRelease: (orderCode: string) => void;
  /** Jump to the arbitration queue — where a disputed order is actually decided. */
  onDecide: () => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <ListFrame>
        {orders.map((order) => (
          <div
            key={order.orderId}
            className="flex flex-col gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-canvas-2/60 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3.5">
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

            <div className="flex flex-wrap items-center gap-3.5 md:justify-end">
              <span className="price text-[15px] leading-none text-astra-ink">
                {formatIDR(order.total)}
              </span>
              {order.waitingArbitration ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge tone="warn" icon={<IconScale size={13} />}>
                    Menunggu arbitrase
                  </Badge>
                  {/* The decision buttons live on the dispute queue; this is the
                      door, so a frozen order is never a dead end. The panel owns
                      the tab state, so switching is instant and needs no
                      navigation. */}
                  <Button variant="secondary" size="sm" onClick={onDecide}>
                    Putuskan sengketa
                  </Button>
                </div>
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
      </ListFrame>

      <Notice tone="info" icon={<IconAlert size={15} />} title="Aturan escrow">
        Payout manual hanya sah untuk pesanan berstatus paid, processing, atau shipped. Pesanan
        yang sedang disengketakan dibekukan sampai putusan arbitrase tercatat di log audit.
      </Notice>
    </div>
  );
}

/* ─── Penarikan ─── */

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
        description="Pengajuan penarikan penjual akan muncul di sini untuk disetujui atau ditolak. Penolakan otomatis mengembalikan dana ke dompet penjual."
        action={
          <ButtonLink href="/admin/cari?jenis=penarikan" variant="secondary" size="sm">
            Riwayat penarikan
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
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
    <RecordFrame tone="warn">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="warn" icon={<IconWallet size={13} />}>
          {row.ref}
        </Badge>
        <span className="price text-[16px] leading-none text-ink">
          {formatIDR(row.amount + row.fee)}
        </span>
        <span className="text-[11px] text-ink-mute">
          {formatIDR(row.amount)} + biaya {formatIDR(row.fee)}
        </span>
        <span className="num ml-auto text-[11px] text-ink-mute">
          {formatDateTime(row.createdAt)}
        </span>
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
    </RecordFrame>
  );
}

/* ─── Jejak audit ─── */

function AuditLog({ logs }: { logs: AdminAuditRow[] }) {
  return (
    <div className="flex flex-col gap-5">
      <ListFrame>
        {logs.map((entry) => (
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
              <span className="num">id {entry.id}</span>
            </div>
          </div>
        ))}
      </ListFrame>

      <RecordFrame>
        <span className="eyebrow text-ink-mute">Matriks hak akses admin (PRD §10)</span>
        <div className="flex flex-col">
          {RBAC.map((row) => (
            <div
              key={row.action}
              className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0"
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
      </RecordFrame>
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
  rateGamepassCover: string;
  rateGamepassNoCover: string;
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
    rateGamepassCover: String(rates.orders.gamepassCover),
    rateGamepassNoCover: String(rates.orders.gamepassNoCover),
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
  const gamepassCover = parsePositive(fields.rateGamepassCover);
  const gamepassNoCover = parsePositive(fields.rateGamepassNoCover);
  const premium = parsePositive(fields.ratePremium);
  const adminFee = parsePositive(fields.adminFee);
  const values = [
    cover, noCover, at2000, at5000, at10000,
    username, login, gamepassCover, gamepassNoCover, premium, adminFee,
  ];
  if (values.some((value) => value === null)) return null;
  const [c, n, v2, v5, v10, u, l, gc, gn, p, f] = values as [
    number, number, number, number, number, number, number, number, number, number, number,
  ];
  return {
    card: {
      cover: c,
      noCover: n,
      volume: { at2000: v2 / 100, at5000: v5 / 100, at10000: v10 / 100 },
    },
    orders: {
      username: u,
      login: l,
      gamepassCover: gc,
      gamepassNoCover: gn,
      premium: p,
      adminFee: f,
    },
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

/** One framed group of rate fields. The console reads as sections, not a form. */
function RateGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="bezel-shell p-1.5">
      <div className="bezel-core flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
          <span className="eyebrow text-ink-mute">{title}</span>
          {hint ? <span className="text-[11px] text-ink-mute">{hint}</span> : null}
        </div>
        {children}
      </div>
    </div>
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
      orderGamepassCover: draft.orders.gamepassCover,
      orderGamepassNoCover: draft.orders.gamepassNoCover,
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={dirty ? "warn" : "astra"} icon={<IconWallet size={13} />}>
          {dirty ? "Ada perubahan belum diterapkan" : "Rate aktif"}
        </Badge>
        <Badge tone="info" className="num">
          Cover {initialRates.card.cover} · No-cover {initialRates.card.noCover} · Fee{" "}
          {formatIDR(initialRates.orders.adminFee)}
        </Badge>
        {dirty ? (
          <button
            type="button"
            className="text-[11px] font-bold text-astra-ink transition-colors duration-200 hover:text-ink"
            onClick={() => setFields(null)}
          >
            Batalkan perubahan
          </button>
        ) : null}
      </div>

      <Notice tone="astra" icon={<IconWallet size={15} />} title="Satu kartu rate untuk semua Robux">
        Rate yang kamu terapkan di sini langsung menggerakkan harga Robux di seluruh situs.
        Perubahan disimpan sebagai baris RateCard baru (yang lama dinonaktifkan) dan tercatat di log
        audit.
      </Notice>

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
        <RateGroup title="Katalog Robux · Rp per Robux bersih" hint="Listing penjual di katalog">
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
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <span className="eyebrow text-ink-mute">Diskon volume (%)</span>
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
          </div>
        </RateGroup>

        <RateGroup
          title="Alur beli Robux · Rp per Robux"
          hint="Harga yang dilihat pembeli di /beli"
        >
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
              id="rate-gamepass-cover"
              label="Gamepass · Cover tax"
              hint="Pajak 30% ditanggung Blox Astra — Rp per Robux bersih"
              suffix="Rp / Robux"
              value={effective.rateGamepassCover}
              onChange={(value) => update("rateGamepassCover", value)}
            />
            <RateInput
              id="rate-gamepass-no-cover"
              label="Gamepass · No cover tax"
              hint="Pajak 30% ditanggung pembeli — Rp per Robux gamepass mentah"
              suffix="Rp / Robux"
              value={effective.rateGamepassNoCover}
              onChange={(value) => update("rateGamepassNoCover", value)}
            />
          </div>
          <div className="border-t border-line pt-4">
            <RateInput
              id="rate-admin-fee"
              label="Biaya admin"
              hint="Ditambahkan ke setiap pesanan alur beli"
              suffix="Rp / order"
              value={effective.adminFee}
              onChange={(value) => update("adminFee", value)}
            />
          </div>
        </RateGroup>

        <RateGroup title="Roblox Premium · Rp per bulan" hint="Alur /beli/premium">
          <RateInput
            id="rate-premium"
            label="Premium / bulan"
            hint="Harga 1 bulan; paket 3 & 12 bulan dihitung dari angka ini"
            suffix="Rp / bulan"
            value={effective.ratePremium}
            onChange={(value) => update("ratePremium", value)}
          />
        </RateGroup>
      </div>

      {draft === null ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Input tidak valid">
          Semua kolom wajib berisi angka. Tarif dan biaya harus lebih besar dari 0; diskon volume
          boleh 0–100.
        </Notice>
      ) : null}

      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="text-[11px] text-ink-mute">
            {dirty
              ? "Perubahan belum aktif sampai kamu menekan Terapkan rate."
              : "Tidak ada perubahan yang menunggu diterapkan."}
          </span>
          <div className="flex flex-wrap gap-2.5">
            <Button
              leadingIcon={<IconCheck size={16} />}
              disabled={!dirty || pending}
              onClick={() => void applyDraft()}
            >
              {pending ? "Menyimpan…" : "Terapkan rate"}
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<IconRefresh size={16} />}
              disabled={pending}
              onClick={() => void handleReset()}
            >
              Reset ke default
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
