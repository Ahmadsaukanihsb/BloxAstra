import { Skeleton } from "@/components/ui/feedback";

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-[1180px] px-4 pb-24 pt-12 md:px-8 md:pt-16"
    >
      <span className="sr-only">Memuat dashboard…</span>
      <div className="flex flex-col gap-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[1.5rem]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Skeleton className="h-72 w-full rounded-[1.5rem]" />
          <Skeleton className="h-72 w-full rounded-[1.5rem]" />
        </div>
      </div>
    </div>
  );
}
