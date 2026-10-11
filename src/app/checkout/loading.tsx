import { Skeleton } from "@/components/ui/feedback";

export default function CheckoutLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-4 pb-24 pt-28 md:px-8 md:pt-36 lg:grid-cols-[1fr_400px] lg:items-start"
    >
      <span className="sr-only">Memuat checkout…</span>
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
