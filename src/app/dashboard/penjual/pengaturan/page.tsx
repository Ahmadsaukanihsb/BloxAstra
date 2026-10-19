import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSellerIdentity } from "@/lib/seller";
import { Badge, TierBadge } from "@/components/ui/badge";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { DiscordWebhookCard } from "@/components/seller/discord-webhook-card";
import { KycResubmitForm } from "@/components/seller/kyc-resubmit";
import { StoreProfileForm } from "@/components/seller/store-profile-form";
import { SellerPageHeader, SellerSection, SellerStack } from "@/components/seller/seller-page";
import { IconInfo, IconSealCheck, IconShieldCheck } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Pengaturan penjual",
  description: "Verifikasi identitas, notifikasi pool Discord, dan informasi toko.",
  robots: { index: false, follow: false },
};

export default function SellerSettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsSkeleton() {
  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-5 h-12 w-64 max-w-full" />
      <Skeleton className="mt-10 h-64 w-full rounded-card" />
    </div>
  );
}

async function SettingsContent() {
  await connection();
  const user = await requireUser();
  const isAdminPreview = user.role === "admin";

  const identity = await getSellerIdentity(user.id);
  if (!identity) {
    return (
      <div className="shell pb-20 pt-8 md:pt-10">
        <Notice tone="danger" title="Profil penjual belum dibuat">
          Akun ini belum memiliki profil toko. Hubungi admin untuk aktivasi penjual.
        </Notice>
      </div>
    );
  }

  const kycLabel = identity.kycVerified
    ? "Terverifikasi"
    : identity.kycStatus === "rejected"
      ? "Ditolak"
      : "Menunggu review";

  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <SellerStack>
        <SellerPageHeader
          eyebrow="Pengaturan"
          title="Identitas & notifikasi"
          lede="Verifikasi identitas membuka listing, sakelar toko online, dan pool rebutan. Webhook Discord hanya mengirim ping order baru ke channel pribadimu."
          meta={
            <Badge tone={identity.kycVerified ? "astra" : "warn"} icon={<IconShieldCheck size={12} />}>
              KYC {kycLabel}
            </Badge>
          }
        />

        {isAdminPreview ? (
          <Notice tone="info" icon={<IconInfo size={15} />} title="Mode preview admin">
            Pengajuan KYC dan penyimpanan webhook dinonaktifkan dalam preview admin.
          </Notice>
        ) : null}

        <SellerSection
          title="Verifikasi identitas (KYC)"
          description="Berkas hanya dilihat admin untuk menyetujui toko. Setelah disetujui, identitas tokomu tampil sebagai penjual terverifikasi di katalog."
        >
          {identity.kycVerified ? (
            <Notice tone="astra" icon={<IconSealCheck size={15} />} title="KYC terverifikasi">
              Identitas toko sudah disetujui admin dan tercatat di log audit. Tidak ada tindakan
              yang diperlukan di sini.
            </Notice>
          ) : identity.kycStatus === "rejected" ? (
            <div className="flex flex-col gap-4">
              <Notice
                tone="danger"
                icon={<IconShieldCheck size={15} />}
                title="Pengajuan sebelumnya ditolak"
              >
                Listing, toko online, dan pool rebutan tetap terkunci sampai berkas baru disetujui.
                Perbaiki sesuai alasan penolakan di bawah, lalu ajukan ulang.
              </Notice>
              {isAdminPreview ? null : (
                <KycResubmitForm rejectReason={identity.kycRejectReason} />
              )}
            </div>
          ) : (
            <Notice
              tone="warn"
              icon={<IconShieldCheck size={15} />}
              title="Menunggu review admin"
            >
              Pengajuanmu sedang di antrean verifikasi. Selama menunggu, listing dan toko online
              dikunci. Status di halaman ini berubah otomatis begitu diputus admin.
            </Notice>
          )}
        </SellerSection>

        <SellerSection
          title="Notifikasi pool Discord"
          description="Saat ada order lunas masuk papan rebutan, Blox Astra mengirim satu ping ke channel ini. Tanpa webhook, kamu hanya melihatnya di papan rebutan."
          action={
            identity.discordWebhook.configured ? (
              <Badge tone={identity.discordWebhook.enabled ? "astra" : "neutral"}>
                {identity.discordWebhook.enabled ? "Aktif" : "Dijeda"}
              </Badge>
            ) : undefined
          }
        >
          <DiscordWebhookCard
            configured={identity.discordWebhook.configured}
            masked={identity.discordWebhook.masked}
            enabled={identity.discordWebhook.enabled}
            disabled={isAdminPreview}
          />
        </SellerSection>

        <SellerSection
          title="Profil toko"
          description="Logo, nama, kota, dan bio tampil di katalog, halaman produk, ruang pesanan, dan daftar order. Perubahan langsung berlaku setelah disimpan."
        >
          <StoreProfileForm
            storeName={identity.storeName}
            city={identity.city}
            bio={identity.bio}
            storeImage={identity.storeImage}
            handle={identity.handle}
            disabled={isAdminPreview}
          />
        </SellerSection>

        <SellerSection title="Statistik toko">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {[
              { label: "Handle", value: identity.handle ? `@${identity.handle}` : "—" },
              { label: "Status toko", value: identity.isOnline ? "Siap kirim" : "Istirahat" },
              {
                label: "Penilaian",
                value:
                  identity.reviewCount > 0
                    ? `${identity.rating.toFixed(1).replace(".", ",")} dari ${identity.reviewCount} ulasan`
                    : "Belum ada ulasan",
              },
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-1">
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-mute">
                  {row.label}
                </dt>
                <dd className="text-[13px] text-ink">{row.value}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-mute">
                Tingkat penjual
              </dt>
              <dd>
                <TierBadge tier={identity.tier} />
              </dd>
            </div>
          </dl>
        </SellerSection>
      </SellerStack>
    </div>
  );
}
