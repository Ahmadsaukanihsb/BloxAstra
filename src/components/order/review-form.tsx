"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReview } from "@/app/actions/room";
import type { OrderReview } from "@/lib/orders";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { StarRating } from "@/components/ui/art";
import { IconAlert, IconStar } from "@/components/ui/icons";

const RATING_LABELS = ["", "Buruk", "Kurang", "Cukup", "Bagus", "Luar biasa"];

/** Star picker + comment for a completed order (buyer only, once). */
export function ReviewForm({ orderCode, sellerName }: { orderCode: string; sellerName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const shown = hovered || rating;

  function submit() {
    if (rating < 1) {
      setError("Pilih dulu bintangnya (1–5).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitReview({ orderCode, rating, comment });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-well bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-bold text-ink">Beri ulasan untuk {sellerName}</span>
        <span className="text-[11px] text-ink-mute">
          Ulasanmu tampil publik di listing dan membentuk rating toko. Hanya bisa sekali.
        </span>
      </div>

      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />}>
          {error}
        </Notice>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating 1 sampai 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} bintang`}
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(value)}
              className="rounded-control p-1 text-robux transition-transform duration-150 hover:scale-110"
            >
              <IconStar size={26} filled={value <= shown} />
            </button>
          ))}
        </div>
        {shown > 0 ? (
          <span className="text-[12px] font-bold text-ink">{RATING_LABELS[shown]}</span>
        ) : null}
      </div>

      <Field
        label="Cerita pengalamanmu (opsional)"
        htmlFor="review-comment"
        hint="Maksimal 500 karakter."
      >
        <TextArea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Barang cepat masuk, penjual ramah…"
          maxLength={500}
        />
      </Field>

      <Button size="sm" className="w-fit" disabled={isPending || rating < 1} onClick={submit}>
        {isPending ? "Mengirim…" : "Kirim ulasan"}
      </Button>
    </div>
  );
}

/** Read-only display of a submitted review. */
export function ReviewCard({ review }: { review: OrderReview }) {
  return (
    <div className="flex flex-col gap-2 rounded-well bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StarRating rating={review.rating} size={14} />
        <span className="num text-[10px] text-ink-mute">{formatDateTime(review.createdAt)}</span>
      </div>
      {review.comment ? (
        <p className="text-[12px] leading-relaxed text-ink-dim">“{review.comment}”</p>
      ) : null}
      <span className="text-[11px] text-ink-mute">
        oleh <span className="font-bold text-ink-dim">{review.buyerName}</span>
      </span>
    </div>
  );
}
