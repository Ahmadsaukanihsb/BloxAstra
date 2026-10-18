"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { SitePopup } from "@/lib/site-notice-slots";
import { IconSparkle, IconX } from "@/components/ui/icons";

/**
 * The homepage pop-up, authored in the admin panel (tab Notifikasi).
 *
 * Shown once per visitor per version: the dismissal is stored under a key that
 * carries `popup.version`, which the save action bumps only when the content
 * actually changes. Editing the notice therefore reaches visitors who already
 * closed the old one, while a re-save without edits re-shows it to nobody.
 *
 * The 700ms delay is deliberate: the hero paints first, so the modal does not
 * race the first impression of the page.
 */
export function HomePopup({ popup }: { popup: SitePopup }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const storageKey = `bloxastra.popup.${popup.version || "v0"}`;

  useEffect(() => {
    if (!popup.enabled) return;
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      // Private mode with storage disabled: showing every time beats not at all.
    }
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [popup.enabled, storageKey]);

  useEffect(() => {
    if (!open) return;
    // Move focus into the dialog so Esc works and screen readers land inside.
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // Storage unavailable — the pop-up may return on the next visit.
      }
      setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, storageKey]);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Storage unavailable — the pop-up may return on the next visit.
    }
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-canvas/70 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) dismiss();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={popup.title || "Pengumuman"}
            tabIndex={-1}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="bezel-shell w-full max-w-md overflow-hidden p-1.5"
          >
            <div className="bezel-core relative flex flex-col">
              {popup.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- data-URL or admin-pasted https URL.
                <img
                  src={popup.image}
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-24 items-center justify-center bg-gradient-to-b from-astra/20 to-transparent text-astra-ink"
                >
                  <IconSparkle size={28} />
                </span>
              )}

              <button
                type="button"
                onClick={dismiss}
                aria-label="Tutup pengumuman"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-canvas/80 text-ink-dim outline outline-1 -outline-offset-1 outline-line backdrop-blur transition-colors duration-200 hover:bg-canvas hover:text-ink"
              >
                <IconX size={15} />
              </button>

              <div className="flex flex-col gap-3 p-5 pt-4">
                {popup.title ? (
                  <h2 className="font-display text-title font-extrabold text-ink">{popup.title}</h2>
                ) : null}
                {popup.message ? (
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-dim">
                    {popup.message}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Link
                    href={popup.ctaHref}
                    onClick={dismiss}
                    className="inline-flex h-11 items-center justify-center rounded-control bg-astra px-5 text-sm font-bold text-on-bright transition-[background-color,transform] duration-200 ease-[var(--ease-astra)] hover:-translate-y-px hover:bg-astra-ink active:translate-y-px"
                  >
                    {popup.ctaLabel}
                  </Link>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="inline-flex h-11 items-center justify-center rounded-control px-4 text-sm font-bold text-ink-dim transition-colors duration-200 hover:bg-canvas-2 hover:text-ink"
                  >
                    Nanti saja
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
