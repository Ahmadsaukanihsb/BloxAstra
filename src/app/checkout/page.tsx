import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getProductDetail } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentFees } from "@/lib/payments";
import { getWalletBalance } from "@/lib/wallet";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Checkout aman",
  description:
    "Selesaikan pembayaran Blox Astra dengan penahanan dana: validasi akun Roblox, pilih metode bayar, dan tinjau pesanan sebelum dana ditahan.",
  robots: { index: false, follow: false },
};

function CheckoutFallback() {
  return (
    <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-4 pb-24 pt-28 md:px-8 md:pt-36 lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-80 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    </div>
  );
}

export default function CheckoutPage(props: PageProps<"/checkout">) {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CheckoutContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const slug = typeof params.produk === "string" ? params.produk : "";
  if (!slug) notFound();
  await connection();

  const [detail, user, paymentFees] = await Promise.all([
    getProductDetail(slug),
    getCurrentUser(),
    getPaymentFees(),
  ]);
  if (!detail) notFound();
  const walletBalance = user ? await getWalletBalance(user.id) : 0;

  const requestedMode = params.mode;
  const mode =
    requestedMode === "no_cover"
      ? "no_cover"
      : requestedMode === "cover"
        ? "cover"
        : (detail.product.pricingMode ?? "cover");
  const qtyRaw = Number(params.qty);
  const quantity = Math.min(5, Math.max(1, Math.floor(qtyRaw) || 1));

  return (
    <CheckoutFlow
      product={detail.product}
      seller={detail.seller}
      category={detail.category}
      isLoggedIn={Boolean(user)}
      initialMode={mode}
      initialQuantity={quantity}
      paymentFees={paymentFees}
      walletBalance={walletBalance}
    />
  );
}
