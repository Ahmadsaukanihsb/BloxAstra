import { ButtonLink } from "@/components/ui/button";
import { IconCompass, IconSearch } from "@/components/ui/icons";

const SUGGESTED = [
  { href: "/katalog", label: "Katalog", leadingIcon: <IconSearch size={16} /> },
  { href: "/beli/robux-username", label: "Top up Robux" },
  { href: "/pesanan", label: "Pesanan saya" },
];

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
      <span className="grid size-14 place-items-center rounded-2xl bg-astra-wash text-astra">
        <IconCompass size={26} />
      </span>

      <div className="flex flex-col gap-2">
        <p className="num text-sm font-extrabold tracking-[0.14em] text-astra">404</p>
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-ink">
          Halaman tidak ditemukan
        </h1>
        <p className="text-sm leading-relaxed text-ink-mute">
          URL yang kamu buka tidak ada atau sudah dipindahkan. Coba salah satu jalan pintas di
          bawah ini.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <ButtonLink href="/" leadingIcon={<IconCompass size={16} />}>
          Ke beranda
        </ButtonLink>
        {SUGGESTED.map((link) => (
          <ButtonLink key={link.href} href={link.href} variant="secondary" leadingIcon={link.leadingIcon}>
            {link.label}
          </ButtonLink>
        ))}
      </div>
    </div>
  );
}
