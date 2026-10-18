import type { RecentReview } from "@/lib/orders";
import { SectionHeading } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";

/**
 * Buyer proof strip, right under the hero. Renders nothing until real
 * reviews with words exist — empty stars would actively hurt trust.
 */
export function Testimonials({ reviews }: { reviews: RecentReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <section className="px-4 pt-10 md:px-8 md:pt-14">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
        <SectionHeading
          title="Kata mereka yang sudah beli"
          description="Ulasan asli dari ruang pesanan yang selesai — bukan testimoni tempelan."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {reviews.map((review) => (
            <figure
              key={review.id}
              className="bezel-shell flex flex-col gap-3 p-1.5"
            >
              <div className="bezel-core flex h-full flex-col gap-3 p-4">
                <span
                  className="text-[13px] font-extrabold tracking-[0.12em] text-gold"
                  aria-label={`${review.rating} dari 5 bintang`}
                >
                  {"★".repeat(review.rating)}
                  <span className="text-ink-mute">{"★".repeat(Math.max(0, 5 - review.rating))}</span>
                </span>
                <blockquote className="line-clamp-4 flex-1 text-[13px] leading-relaxed text-ink-dim">
                  “{review.comment}”
                </blockquote>
                <figcaption className="flex flex-col gap-0.5 border-t border-line pt-3">
                  <span className="text-[12px] font-extrabold text-ink">{review.buyerName}</span>
                  <span className="truncate text-[11px] text-ink-mute">
                    {review.productTitle} · {formatDateTime(review.createdAt)}
                  </span>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
