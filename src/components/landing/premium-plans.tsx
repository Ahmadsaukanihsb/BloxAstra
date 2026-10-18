import Link from "next/link";
import { getProducts } from "@/lib/catalog";
import { cx } from "@/lib/cx";
import { formatIDR } from "@/lib/format";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { IconCrown } from "@/components/ui/icons";
import { ShelfEmpty } from "@/components/landing/shelf-empty";

/** 3-month term is sold 15% under three single months. */
const QUARTER_DISCOUNT = 0.15;
/** A year is charged as ten months. */
const YEAR_MONTHS = 10;

const roundUpToThousand = (value: number) => Math.ceil(value / 1_000) * 1_000;

export async function PremiumPlans() {
  const products = await getProducts();
  const monthly = products
    .filter((product) => product.category === "premium")
    .sort((a, b) => a.price - b.price)[0];

  // Terms can only be priced off a live monthly listing, but Premium itself can
  // still be bought straight from the platform — so the empty state sells that
  // instead of disappearing.
  if (!monthly) {
    return (
      <ShelfEmpty
        title={
          <>
            Roblox <span className="text-astra-ink">Premium</span>
          </>
        }
        description="Term 1, 3, dan 12 bulan dihitung dari harga penjual — belum ada listing Premium yang aktif hari ini."
        action={{ href: "/beli/premium", label: "Beli Premium langsung", variant: "primary" }}
        label="Rak Premium masih kosong"
        body="Jalur Premium milik platform tidak butuh stok penjual: pilih durasinya, bayar, dan langganan diproses seperti biasa."
        icon={<IconCrown size={17} />}
        secondary={{ href: "/katalog?kategori=premium", label: "Lihat katalog" }}
      />
    );
  }

  const MONTHLY_PRICE = monthly.price;

  const PLANS = [
    { term: "1 Bulan", price: formatIDR(MONTHLY_PRICE), badge: null, href: "/katalog?kategori=premium" },
    {
      term: "3 Bulan",
      price: formatIDR(roundUpToThousand(MONTHLY_PRICE * 3 * (1 - QUARTER_DISCOUNT))),
      badge: {
        label: `Hemat ${Math.round(QUARTER_DISCOUNT * 100)}%`,
        className: "bg-success text-on-bright",
      },
      href: "/katalog?kategori=premium",
    },
    {
      term: "1 Tahun",
      price: formatIDR(MONTHLY_PRICE * YEAR_MONTHS),
      badge: {
        label: `Irit hingga ${formatIDR(MONTHLY_PRICE * (12 - YEAR_MONTHS))}`,
        className: "bg-astra text-white",
      },
      href: "/katalog?kategori=premium",
    },
  ];

  return (
    <section className="px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 lg:grid-cols-[300px_1fr] lg:items-center">
        <Reveal>
          <div className="flex flex-col gap-1.5">
 <h2 className="text-title font-extrabold leading-tight text-ink md:text-title">
              Roblox <span className="text-astra-ink">Premium</span>
            </h2>
            <p className="text-[13px] text-ink-dim md:text-sm">
              Lebih banyak keuntungan & hadiah eksklusif
            </p>
          </div>
        </Reveal>

        <RevealGroup className="grid grid-cols-1 gap-3.5 sm:grid-cols-3" stagger={0.06}>
          {PLANS.map((plan) => (
            <RevealItem key={plan.term} className="h-full">
              <div className="relative flex h-full flex-col gap-4 rounded-card border border-line bg-paper p-5">
                {plan.badge ? (
                  <span
                    className={cx(
                      "absolute -top-2.5 right-4 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em]",
                      plan.badge.className,
                    )}
                  >
                    {plan.badge.label}
                  </span>
                ) : null}

                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-astra-wash text-astra-ink">
                    <IconCrown size={22} />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-extrabold text-ink">{plan.term}</span>
                    <span className="num text-[15px] font-extrabold text-astra-ink">{plan.price}</span>
                  </div>
                </div>

                <Link
                  href={plan.href}
                  className="accent-fill mt-auto flex h-10 items-center justify-center rounded-control text-[11px] font-extrabold uppercase tracking-[0.06em] text-white transition-[filter] duration-300 hover:brightness-[1.08]"
                >
                  Langganan sekarang
                </Link>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
