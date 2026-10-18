import type { ReactNode } from "react";
import { Notice } from "@/components/ui/feedback";
import { IconAlert } from "@/components/ui/icons";
import { LEGAL_UPDATED, missingOperatorFields } from "@/lib/legal";

export interface LegalSectionRef {
  id: string;
  label: string;
}

/**
 * Shell for the policy pages.
 *
 * These are the only pages in the app that are meant to be read start to
 * finish, so the reading column is capped at 68 characters and the index sits
 * beside it rather than above it — you want to keep the section list in view
 * while you scroll through a document, and you do not want to re-read a table
 * of contents by scrolling past it.
 *
 * The incomplete-fields notice is not decoration. A privacy notice has to name
 * the entity that controls the data, and the operator fields come from
 * `lib/legal.ts`, where the empty ones await an answer from the operator.
 * Rendering the gap keeps an unfinished policy from looking finished.
 */
export function LegalPage({
  title,
  lede,
  sections,
  meta,
  children,
}: {
  title: string;
  lede: string;
  sections: LegalSectionRef[];
  /** Replaces the "last updated" line. Pass null on pages that are not versioned. */
  meta?: ReactNode | null;
  children: ReactNode;
}) {
  const missing = missingOperatorFields();

  return (
    <div className="shell pb-24 pt-10 md:pt-14">
      <div className="flex flex-col gap-8 border-b border-line pb-8">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-page font-extrabold text-ink">{title}</h1>
          <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-dim md:text-sm">{lede}</p>
        </div>
        {meta === null ? null : (
          <p className="num text-[11px] text-ink-mute">
            {meta ?? `Terakhir diperbarui ${LEGAL_UPDATED}`}
          </p>
        )}
      </div>

      {missing.length ? (
        <Notice tone="warn" title="Halaman ini belum lengkap" className="mt-8" icon={<IconAlert size={16} />}>
          <p>
            Bagian berikut masih kosong dan hanya bisa diisi oleh pengelola Blox Astra. Selama
            kosong, halaman ini belum bisa dipakai sebagai rujukan resmi.
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
            {missing.map((field) => (
              <li key={field.key}>
                <strong className="font-bold text-ink">{field.label}</strong> — {field.why}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14">
        {/* `min-w-0` on the reading column: without it a long token in the prose
            can force the grid wider than the viewport. */}
        <article
          className={[
            "flex min-w-0 flex-col gap-9 text-[14px] leading-relaxed text-ink-dim",
            "[&_h2]:font-display [&_h2]:text-[1.1rem] [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-ink",
            "[&_h3]:text-[13px] [&_h3]:font-extrabold [&_h3]:text-ink",
            "[&_p]:max-w-[68ch]",
            "[&_ul]:flex [&_ul]:max-w-[68ch] [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5",
            "[&_ol]:flex [&_ol]:max-w-[68ch] [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2.5 [&_ol]:pl-5",
            // Written as an explicit `li::marker` selector rather than the
            // `marker:` variant, because composing `[&_li]` with `marker:`
            // produces a selector Tailwind does not guarantee.
            "[&_li::marker]:text-ink-mute",
            "[&_strong]:font-bold [&_strong]:text-ink",
            "[&_a]:text-astra-ink [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-4",
          ].join(" ")}
        >
          {children}
        </article>

        <nav aria-label="Daftar isi" className="lg:sticky lg:top-24 lg:self-start">
          <p className="tag mb-3 text-ink-mute">Isi halaman</p>
          <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex rounded-tag px-2 py-1.5 text-[12px] font-bold text-ink-dim transition-colors duration-200 hover:bg-canvas-2 hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/** One titled block of the document. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3.5">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
