import type { Metadata } from "next";
import { connection } from "next/server";
import { LegalPage, LegalSection, type LegalSectionRef } from "@/components/site/legal-page";
import { OPERATOR, PRIVACY_UPDATED, RETENTION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Kebijakan privasi",
  description:
    "Ringkasan singkat: data apa yang dikumpulkan Blox Astra, untuk apa, siapa yang menerimanya, berapa lama disimpan, dan hak kamu.",
  alternates: { canonical: "/kebijakan-privasi" },
};

const SECTIONS: LegalSectionRef[] = [
  { id: "pengendali", label: "Pengendali data" },
  { id: "data", label: "Data & pemakaian" },
  { id: "cookie", label: "Cookie" },
  { id: "penerima", label: "Penerima data" },
  { id: "retensi", label: "Penyimpanan & keamanan" },
  { id: "hak", label: "Hak kamu" },
  { id: "anak", label: "Di bawah umur & perubahan" },
];

export default async function PrivacyPage() {
  // Operator fields come from `.env` (LEGAL_OPERATOR_*); render per request so
  // filling them in never waits for a rebuild.
  await connection();
  return (
    <LegalPage
      title="Kebijakan privasi"
      lede="Ringkasnya: data yang kamu berikan dipakai untuk menjalankan transaksi, tidak dijual, dan bisa kamu minta hapus. Ditulis mengikuti UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi."
      sections={SECTIONS}
      meta={`Terakhir diperbarui ${PRIVACY_UPDATED}`}
    >
      <LegalSection id="pengendali" title="Pengendali data">
        <p>
          Pengendali datamu adalah{" "}
          <strong>{OPERATOR.entity.trim() || "[nama badan hukum belum diisi]"}</strong>
          {OPERATOR.address.trim() ? `, ${OPERATOR.address}` : ""}. Permintaan salinan, koreksi,
          atau penghapusan dikirim ke{" "}
          <strong>{OPERATOR.email.trim() || "[alamat pengaduan belum diisi]"}</strong>
          {OPERATOR.phone.trim() ? ` atau ${OPERATOR.phone}` : ""}, dengan bukti kepemilikan akun.
        </p>
      </LegalSection>

      <LegalSection id="data" title="Data & pemakaian">
        <ul>
          <li>
            <strong>Akun:</strong> email, nama pengguna, kata sandi ter-hash, nomor WhatsApp
            terverifikasi, dan identitas dari Google/Discord bila kamu masuk lewat mereka.
          </li>
          <li>
            <strong>Pesanan &amp; dompet:</strong> isi dan riwayat pesanan, catatan dan percakapan
            ruang pesanan, mutasi saldo, serta rekening penarikan. Kredensial pesanan tersimpan
            terenkripsi; nomor kartu tidak pernah kami simpan.
          </li>
          <li>
            <strong>Verifikasi penjual (KYC):</strong> nama, kota, foto identitas, dan swafoto —
            hanya bila kamu membuka toko, atas persetujuanmu.
          </li>
          <li>
            <strong>Teknis:</strong> daftar keinginan, ulasan, notifikasi, serta IP dan jejak audit
            tindakan admin agar perubahan data bisa ditelusuri.
          </li>
        </ul>
        <p>
          Pemakaiannya: menjalankan layanan (akun, escrow, notifikasi, sengketa); atas
          persetujuanmu (verifikasi WhatsApp dan KYC — bisa ditarik kapan saja); kewajiban hukum
          (catatan transaksi); dan kepentingan sah (mencegah penipuan). Tidak untuk iklan, tidak
          dijual.
        </p>
      </LegalSection>

      <LegalSection id="cookie" title="Cookie">
        <p>
          Hanya satu cookie: <strong>bloxastra_session</strong> untuk sesi masuk (httpOnly,
          SameSite=Lax, Secure di produksi). Tidak ada cookie iklan, analitik, atau pelacak pihak
          ketiga — karena itu situs ini tanpa banner persetujuan cookie.
        </p>
      </LegalSection>

      <LegalSection id="penerima" title="Penerima data">
        <p>
          <strong>Tripay</strong> memproses pembayaran; <strong>Google dan Discord</strong> hanya
          bila kamu memilih masuk lewat mereka; <strong>pengirim kode WhatsApp</strong> menerima
          nomor dan isi pesan OTP; <strong>Discord penjual</strong> menerima ringkasan pesanan bila
          penjual menyalakan webhook-nya; <strong>penyedia hosting</strong> menyimpan basis data dan
          berkas aplikasi. Kredensial pesanan tidak keluar dari alur pesanan, dan data pribadi
          tidak kami jual.
        </p>
      </LegalSection>

      <LegalSection id="retensi" title="Penyimpanan & keamanan">
        <p>
          Catatan transaksi keuangan disimpan minimal <strong>{RETENTION.financial}</strong> dan
          non-keuangan minimal <strong>{RETENTION.nonFinancial}</strong> sesuai kewajiban
          penyelenggara perdagangan elektronik; sisanya dihapus bersama akun. Kode OTP disimpan
          ter-hash dan berlaku {RETENTION.otpMinutes} menit. Kata sandi ter-hash, kredensial
          pesanan dienkripsi AES-256-GCM dengan kunci yang terpisah dari basis data, dan setiap
          tindakan admin terhadap datamu tercatat di jejak audit. Bila terjadi kebocoran yang
          berisiko bagimu, kamu dan pihak berwenang kami beri tahu.
        </p>
      </LegalSection>

      <LegalSection id="hak" title="Hak kamu">
        <p>
          Kamu berhak mendapat salinan datamu, memperbaikinya, meminta penghapusan atau
          penghentian pemrosesan, menarik persetujuan, membatasi dan memindahkan datamu sejauh
          sistem memungkinkan, serta mengadu — semuanya lewat kontak di bagian pertama. Catatan
          transaksi yang wajib disimpan peraturan tidak bisa dihapus lebih awal; bila itu berlaku,
          kami beri tahu bagian mana yang tertahan dan mengapa.
        </p>
      </LegalSection>

      <LegalSection id="anak" title="Di bawah umur & perubahan">
        <p>
          Layanan ini untuk usia minimal <strong>{OPERATOR.minAge}</strong>; orang tua atau wali
          bisa menghubungi kami untuk menghapus akun anaknya, kecuali bagian yang wajib disimpan.
          Bila ada tujuan pemrosesan atau penerima data baru, kami memberi tahu sebelum berlaku
          dan memperbarui tanggal di atas — kamu selalu bisa berhenti memakai layanan bila tidak
          setuju.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
