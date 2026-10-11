import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="shell pb-24 pt-24 md:pt-28"
    >
      <span className="sr-only">Memuat halaman…</span>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-card border border-line bg-paper p-3"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-well" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
