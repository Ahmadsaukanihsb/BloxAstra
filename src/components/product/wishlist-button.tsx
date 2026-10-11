"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWishlist } from "@/app/actions/wishlist";
import { cx } from "@/lib/cx";
import { IconHeart } from "@/components/ui/icons";

/**
 * Save/unsave heart. Must stopPropagation — it lives inside product links.
 * Logged-out clicks fall through to /masuk via requireUser.
 */
export function WishlistButton({
  productId,
  initialSaved = false,
  size = 16,
  className,
}: {
  productId: string;
  initialSaved?: boolean;
  size?: number;
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    startTransition(async () => {
      const result = await toggleWishlist({ productId });
      if (!result.ok) return;
      setSaved(result.saved);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      aria-label={saved ? "Hapus dari wishlist" : "Simpan ke wishlist"}
      aria-pressed={saved}
      disabled={isPending}
      onClick={toggle}
      className={cx(
        "grid shrink-0 place-items-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-60",
        saved
          ? "text-astra-ink"
          : "text-ink-mute hover:text-astra-ink",
        className ?? "size-8 bg-paper/95 outline outline-1 -outline-offset-1 outline-line backdrop-blur-sm",
      )}
    >
      <IconHeart size={size} filled={saved} />
    </button>
  );
}
