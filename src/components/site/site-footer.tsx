import Link from "next/link";
import type { Category } from "@/lib/types";
import { AstraMark, IconShieldCheck, IconSealCheck, IconLock, IconHeadset } from "@/components/ui/icons";

function buildColumns(categories: Category[]) {
  return [
    {
      title: "Kategori",
      links: categories.map((category) => ({
        label: category.name,
        href: `/katalog?kategori=${category.slug}`,
      })),
    },
  {
    title: "Keamanan",
    links: [
      { label: "Cara kerja penahanan dana", href: "/katalog" },
      { label: "Platform Protection Fund", href: "/katalog" },
      { label: "Verifikasi penjual (KYC)", href: "/daftar" },
      { label: "Pusat sengketa", href: "/pesanan" },
      { label: "Penjenjangan penjual", href: "/katalog" },
    ],
  },
  {
    title: "Penjual",
    links: [
      { label: "Buka toko", href: "/daftar" },
      { label: "Dashboard penjual", href: "/dashboard/penjual" },
      { label: "Statistik toko", href: "/dashboard/penjual" },
      { label: "Dompet & penarikan", href: "/dompet" },
      { label: "Aturan batas volume", href: "/dashboard/penjual" },
    ],
  },
  ];
}

const assurances = [
  { label: "Dana ditahan terpantau", icon: IconShieldCheck },
  { label: "KYC manual penjual", icon: IconSealCheck },
  { label: "Kredensial pesanan dienkripsi", icon: IconLock },
  { label: "Notifikasi dalam akun", icon: IconHeadset },
];

export function SiteFooter({ categories }: { categories: Category[] }) {
  const columns = buildColumns(categories);
  return (
    <footer className="relative z-10 mt-16 border-t border-line bg-paper px-4 pb-32 pt-10 md:px-8 md:pb-14 md:pt-12">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-14">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_2fr]">
          <div className="flex flex-col gap-5">
            <span className="flex items-center gap-2.5 text-astra-ink">
              <AstraMark size={30} />
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                Blox<span className="text-astra-ink">Astra</span>
              </span>
            </span>
            <p className="max-w-[44ch] text-sm leading-relaxed text-ink-dim">
              Marketplace vertikal Roblox dengan dana ditahan di rekening platform, penjual terverifikasi
              identitas fisik, dan dana talangan pembeli dari Platform Protection Fund.
            </p>
            <div className="flex flex-wrap gap-2">
              {assurances.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-[11px] text-ink-dim outline outline-1 -outline-offset-1 outline-line"
                >
                  <item.icon size={14} className="text-astra-ink" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title} className="flex flex-col gap-4">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-ink">
                  {column.title}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-ink-dim transition-colors duration-300 hover:text-astra-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-8 text-[11px] text-ink-mute md:flex-row md:items-center md:justify-between">
          <p>
            © 2026 Blox Astra. Bukan afiliasi resmi Roblox Corporation. Robux dan Roblox adalah
            merek dagang Roblox Corporation.
          </p>
          <p className="num flex items-center gap-4">
            <Link
              href="/admin"
              className="text-ink-mute underline decoration-dotted underline-offset-4 transition-colors duration-300 hover:text-astra-ink"
            >
              Panel admin
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
