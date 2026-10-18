import Link from "next/link";
import { cx } from "@/lib/cx";
import { blogUrl } from "@/lib/site";
import { getSiteLogo } from "@/lib/site-logo";
import { getSocialLinks } from "@/lib/social-links";
import { SOCIAL_SLOTS, type SocialPlatformId } from "@/lib/social-links-slots";
import {
  IconDiscord,
  IconFacebook,
  IconInstagram,
  IconTiktok,
  IconWhatsapp,
  IconXTwitter,
  IconYoutube,
} from "@/components/ui/icons";
import { BrandMark } from "@/components/site/brand-mark";

const SOCIAL_ICONS: Record<
  SocialPlatformId,
  (props: { size?: number; className?: string }) => React.JSX.Element
> = {
  discord: IconDiscord,
  instagram: IconInstagram,
  tiktok: IconTiktok,
  youtube: IconYoutube,
  facebook: IconFacebook,
  x: IconXTwitter,
  whatsapp: IconWhatsapp,
};

/**
 * The shop sign-off.
 *
 * Three blocks of links used to live here — category chips, a "Beli" grid, and
 * a "Jelajahi" grid — which the sticky navbar already carries: the Kategori
 * menu lists the same five categories to the same destinations, and the primary
 * links and the account menu cover the rest. Repeating them made the footer the
 * longest part of every page while adding no path a visitor could not already
 * take. They are gone rather than trimmed, because a shorter list of the same
 * links is still the same links.
 *
 * What is left is what a footer is actually for: who runs the shop, the one
 * promise the shop makes, and the documents a marketplace has to publish.
 *
 * Two things are deliberately absent. There is no "Panel admin" link, because
 * this is a public page, and no link to a page that does not exist — every
 * destination here is a real route.
 */
export async function SiteFooter() {
  const [logo, social] = await Promise.all([getSiteLogo(), getSocialLinks()]);
  const socialLinks = SOCIAL_SLOTS.filter((slot) => social[slot.id]);
  return (
    <footer className="relative z-10 mt-16 border-t border-line bg-paper px-4 pb-32 pt-12 md:px-8 md:pb-16 md:pt-14">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-12">
          <div className="flex flex-col gap-4">
            <span className="flex items-center gap-2.5 text-astra-ink">
              <BrandMark logo={logo} size={30} />
              {!logo ? (
                <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                  Blox<span className="text-astra-ink">Astra</span>
                </span>
              ) : null}
            </span>
            <p className="max-w-[46ch] text-sm leading-relaxed text-ink-dim">
              Marketplace Robux dan item Roblox. Dana pembeli ditahan platform dan baru cair ke
              penjual setelah barang diterima, dengan penjual yang identitasnya diverifikasi.
            </p>
            {/* Only the platforms the admin filled in — an empty slot is not
                rendered, so nothing here links nowhere. */}
            {socialLinks.length > 0 ? (
              <span className="flex flex-wrap items-center gap-2">
                {socialLinks.map((slot) => {
                  const Icon = SOCIAL_ICONS[slot.id];
                  return (
                    <a
                      key={slot.id}
                      href={social[slot.id]}
                      target="_blank"
                      rel="noopener noreferrer me"
                      aria-label={`${slot.label} Blox Astra`}
                      title={slot.label}
                      className="flex size-9 items-center justify-center rounded-full border border-line bg-paper transition-colors duration-200 hover:border-astra-ink/40 hover:bg-canvas-2"
                    >
                      <Icon size={18} />
                    </a>
                  );
                })}
              </span>
            ) : null}
          </div>

          {/* Sits beside the blurb rather than under it: with the link blocks
              gone, the promise is the only thing balancing the sign-off, and a
              right-aligned second column is what keeps the row from reading as
              one short paragraph stranded in a wide footer. */}
          <p className="max-w-[34ch] text-[13px] leading-relaxed text-ink-mute md:text-right">
            Blox Astra menahan dana pembeli selama pesanan berjalan, dan mengembalikannya otomatis
            bila pesanan tidak bergerak.
          </p>
        </div>

        <div
          className={cx(
            "flex flex-col gap-3 border-t border-line pt-7 text-[11px] leading-relaxed text-ink-mute",
            "md:flex-row md:items-center md:justify-between md:gap-8",
          )}
        >
          <p className="max-w-[62ch]">
            © 2026 Blox Astra. Bukan afiliasi resmi Roblox Corporation. Robux dan Roblox adalah
            merek dagang Roblox Corporation.
          </p>
          {/* The pages a marketplace is expected to publish, the one that
              explains the service itself, and the blog. All are real routes,
              so no link here promises something that is not there. */}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 md:shrink-0">
            <Link
              href={blogUrl("/")}
              className="font-bold text-ink-dim underline decoration-dotted underline-offset-4 transition-colors duration-200 hover:text-astra-ink"
            >
              Blog
            </Link>
            <Link
              href="/tentang"
              className="font-bold text-ink-dim underline decoration-dotted underline-offset-4 transition-colors duration-200 hover:text-astra-ink"
            >
              Tentang Blox Astra
            </Link>
            <Link
              href="/kebijakan-privasi"
              className="font-bold text-ink-dim underline decoration-dotted underline-offset-4 transition-colors duration-200 hover:text-astra-ink"
            >
              Kebijakan privasi
            </Link>
            <Link
              href="/syarat-layanan"
              className="font-bold text-ink-dim underline decoration-dotted underline-offset-4 transition-colors duration-200 hover:text-astra-ink"
            >
              Syarat layanan
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
