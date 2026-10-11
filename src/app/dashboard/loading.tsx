import { Skeleton } from "@/components/ui/feedback";

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="shell pb-20 pt-8 md:pt-10"
    >
      <span className="sr-only">Memuat dashboard…</span>
      <div className="flex flex-col gap-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-card" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Skeleton className="h-72 w-full rounded-card" />
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
