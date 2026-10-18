import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LegalPage, LegalSection, type LegalSectionRef } from "@/components/site/legal-page";
import { Surface } from "@/components/ui/surface";
import { TierBadge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/format";
import {
  ESCROW_WINDOWS,
  OFFSITE,
  OPERATOR,
  PAYMENT_METHODS_LEGAL,
  SELLER_TIERS,
  WITHDRAWAL_FEE,
} from "@/lib/legal";
import { IconFingerprint, IconRefresh, IconShieldCheck } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Tentang Blox Astra",
  description:
    "Apa itu Blox Astra, bagaimana dana pembeli ditahan dan dilepas, apa yang dijamin sistem, dan siapa yang menjalankannya.",
  alternates: { canonical: "/tentang" },
};

const SECTIONS: LegalSectionRef[] = [
  { id: "apa", label: "Apa ini" },
  { id: "cara", label: "Alur transaksi" },
  { id: "jaminan", label: "Apa yang dijamin" },
  { id: "penjual", label: "Untuk penjual" },
  { id: "biaya", label: "Biaya" },
  { id: "operator", label: "Siapa di baliknya" },
  { id: "dokumen", label: "Ketentuan dan datamu" },
];

/**
 * The three guarantees, matching the ones the terms describe in "Peran kami".
 *
 * They are listed here with the mechanism each one actually runs on, because a
 * promise a reader cannot check is just marketing. The windows come from
 * `ESCROW_WINDOWS` and the tier caps from `SELLER_TIERS`, so neither drifts
 * away from the job or the dashboard that enforces them.
 */
const GUARANTEES = [
  {
    icon: IconShieldCheck,
    title: "Dana ditahan",
    body: "Uang pembeli tidak masuk ke penjual saat dibayar. Platform menahannya, dan baru melepasnya ketika pembeli menekan konfirmasi atau jendela konfirmasi habis.",
  },
  {
    icon: IconFingerprint,
    title: "Penjual diverifikasi",
    body: "Untuk membuka toko, penjual menjalani verifikasi identitas. Tanpa itu, mereka tidak bisa memasang listing.",
  },
  {
    icon: IconRefresh,
    title: "Pengembalian otomatis",
    body: "Pesanan yang tidak bergerak dikembalikan tanpa pembeli perlu menagih, karena tenggatnya diperiksa oleh tugas terjadwal di server.",
  },
] as const;

export default async function AboutPage() {
  // Operator fields come from `.env` (LEGAL_OPERATOR_*); render per request so
  // filling them in never waits for a rebuild.
  await connection();
  return (
    <LegalPage
      title="Tentang Blox Astra"
      lede="Blox Astra adalah tempat bertemunya pembeli dan penjual Robux, item, gift card, dan langganan Premium Roblox. Halaman ini menjelaskan cara kerjanya, apa yang benar-benar dijamin sistem, dan siapa yang menjalankannya."
      sections={SECTIONS}
      meta={
        <>
          Dijalankan oleh <strong className="text-ink">{OPERATOR.entity}</strong>
        </>
      }
    >
      <LegalSection id="apa" title="Apa yang Blox Astra lakukan">
        <p>
          Kami mempertemukan dua sisi pasar. Yang menjual barang dan menyerahkannya adalah penjual
          yang membuka toko di sini — bukan kami. Yang kami kerjakan adalah bagian yang membuat
          transaksi antara orang yang tidak saling kenal jadi masuk akal: menahan uang pembeli,
          memastikan penjual punya identitas yang bisa ditagih, dan memutuskan ke mana uang pergi
          ketika kedua sisi tidak sepakat.
        </p>
        <p>{OFFSITE.robloxNotAffiliated}</p>
      </LegalSection>

      <LegalSection id="cara" title="Bagaimana satu transaksi berjalan">
        <ol>
          <li>
            <strong>Pembeli memilih listing.</strong> Halaman listing menyebut apa yang dijual,
            metode penyerahannya, dan berapa lama jendela konfirmasinya — angka itu bisa berbeda
            antar listing, jadi yang berlaku selalu yang tertulis di listing yang kamu buka.
          </li>
          <li>
            <strong>Pembeli membayar, dan dananya ditahan.</strong> Pembayaran diproses oleh
            penyedia pembayaran pihak ketiga. Mulai titik ini, uang itu tidak bisa langsung ditarik
            penjual.
          </li>
          <li>
            <strong>Penjual menyerahkan barang.</strong> Untuk pesanan yang diperebutkan, penjual
            mengambilnya dari kelompok; kalau tidak ada yang mengambil dalam{" "}
            <strong>{ESCROW_WINDOWS.poolHours} jam</strong>, pesanan batal dan dananya kembali.
          </li>
          <li>
            <strong>Dana dilepas.</strong> Setelah pembeli mengonfirmasi, atau setelah jendela
            konfirmasi habis tanpa keluhan. Kalau pembeli membuka sengketa sebelum itu, pelepasan
            ditahan sampai admin memutuskan.
          </li>
        </ol>
        <p>
          Selain itu, tiga tenggat berjalan sendiri di belakang: pesanan yang sudah diambil penjual
          tetapi belum mulai dikerjakan dalam <strong>{ESCROW_WINDOWS.assignedHours} jam</strong>,
          dan pesanan berstatus diproses yang tidak bergerak selama{" "}
          <strong>{ESCROW_WINDOWS.processingDays} hari</strong>, keduanya dikembalikan otomatis
          tanpa perlu diminta.
        </p>
      </LegalSection>

      <LegalSection id="jaminan" title="Apa yang benar-benar dijamin">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {GUARANTEES.map((item) => (
            <Surface key={item.title} coreClassName="p-4">
              <span className="grid size-9 place-items-center rounded-control bg-astra/[0.09] text-astra-ink">
                <item.icon size={17} />
              </span>
              <p className="mt-3 text-[13px] font-extrabold text-ink">{item.title}</p>
              <p className="mt-1.5 max-w-none text-[12px] leading-relaxed text-ink-dim">
                {item.body}
              </p>
            </Surface>
          ))}
        </div>
        <p>
          Ketika pembeli dan penjual berselisih, keduanya membuka dan menjawab sengketa dengan bukti
          dari dalam halaman pesanan. Admin memeriksa kedua sisi dan memilih satu dari dua hasil:
          dana kembali penuh ke pembeli, atau diteruskan ke penjual. Target penanganannya{" "}
          <strong>{ESCROW_WINDOWS.disputeSlaHours} jam</strong> sejak sengketa dibuka, dan selama
          itu dananya beku — tidak ada pihak yang bisa menariknya.
        </p>
        <p>
          Yang tidak kami lakukan: menjamin mutu barang, dan mempercepat penjual merespons di luar
          tenggat yang sistem jalankan. Bila penjual tidak bertindak, yang menyelamatkan uangmu
          adalah tenggat otomatis di atas, bukan imbauan.
        </p>
      </LegalSection>

      <LegalSection id="penjual" title="Kalau kamu ingin berjualan">
        <p>
          Calon penjual menjalani verifikasi identitas lebih dulu, lalu mulai dari Tier 1 dan naik
          berdasarkan rekam jejak toko. Kenaikan tier ditinjau manual oleh admin — antara lain
          melihat rasio sengketa — jadi tidak ada yang naik sendiri hanya karena rajin berjualan
          dalam sehari.
        </p>
        <ul>
          {SELLER_TIERS.map((entry) => (
            <li key={entry.tier}>
              <TierBadge tier={entry.tier} /> — plafon penjualan{" "}
              <strong>{formatIDR(entry.dailyCap)}</strong> per hari. {entry.note}
            </li>
          ))}
        </ul>
        <p>
          Penghasilan yang sudah lepas dari penahanan masuk ke saldo penjual, dan bisa dicairkan ke
          rekening bank yang mereka daftarkan. Biaya penarikan {WITHDRAWAL_FEE} per permintaan.
          Pembeli yang mengajak atau menerima transaksi di luar platform kehilangan penahanan dana —
          itu satu-satunya pelindungan yang membuat transaksi di sini berbeda dari transfer
          langsung.
        </p>
      </LegalSection>

      <LegalSection id="biaya" title="Biaya yang kamu bayar">
        <p>
          Harga barang ada di listing. Di atasnya, sebagian metode pembayaran menambahkan biaya
          penyedia pembayaran yang kami teruskan apa adanya:
        </p>
        <ul>
          {PAYMENT_METHODS_LEGAL.map((method) => (
            <li key={method.label}>
              <strong>{method.label}</strong> — {method.fee}.
            </li>
          ))}
        </ul>
        <p>
          Tidak ada biaya berlangganan, tidak ada biaya tersembunyi di halaman terakhir, dan kami
          tidak menjual data pembeli.
        </p>
      </LegalSection>

      <LegalSection id="operator" title="Siapa yang menjalankan layanan ini">
        <p>
          Layanan ini dijalankan oleh{" "}
          <strong>{OPERATOR.entity.trim() || "[nama badan hukum belum diisi]"}</strong>
          {OPERATOR.address.trim() ? `, beralamat di ${OPERATOR.address}` : ""}. Pertanyaan tentang
          layanan, pesanan, maupun data pribadimu bisa dikirim ke{" "}
          <strong>{OPERATOR.email.trim() || "[alamat pengaduan belum diisi]"}</strong>
          {OPERATOR.phone.trim() ? ` atau ${OPERATOR.phone}` : ""}.
        </p>
        <p>
          Nomor tanda daftar Penyelenggara Sistem Elektronik kami adalah{" "}
          <strong>{OPERATOR.pseNumber.trim() || "[nomor PSE belum diisi]"}</strong>.
        </p>
      </LegalSection>

      <LegalSection id="dokumen" title="Ketentuan dan datamu">
        <p>
          Aturan pemakaian layanan, termasuk cara dana ditahan, pembatalan, dan pengembalian dana,
          ada di <Link href="/syarat-layanan">Syarat layanan</Link>. Data apa yang kami kumpulkan,
          untuk apa, siapa yang menerimanya, dan bagaimana kamu bisa meminta penghapusan ada di{" "}
          <Link href="/kebijakan-privasi">Kebijakan privasi</Link>.
        </p>
        <p>
          Keduanya menjelaskan perilaku aplikasi yang sebenarnya, bukan klausul umum yang disalin
          dari tempat lain: angka tenggat di halaman ini dibaca langsung dari tenggat yang
          dijalankan sistem, sehingga tidak bisa berbeda dari yang kamu alami saat bertransaksi.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
