import { Skeleton } from "@/components/ui/feedback";

export default function OrderRoomLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="shell pb-24 pt-24 md:pt-28"
    >
      <span className="sr-only">Memuat ruang pesanan…</span>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-2/3" />
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-40 w-full rounded-card" />
            <Skeleton className="h-72 w-full rounded-card" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-64 w-full rounded-card" />
            <Skeleton className="h-48 w-full rounded-card" />
          </div>
        </div>
      </div>
    </div>
  );
}
