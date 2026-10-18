import type { Metadata } from "next";
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
  { id: "data", label: "Data yang dikumpulkan" },
  { id: "tujuan", label: "Cara kami memakainya" },
  { id: "cookie", label: "Cookie" },
  { id: "penerima", label: "Penerima data" },
  { id: "retensi", label: "Penyimpanan & keamanan" },
  { id: "hak", label: "Hak kamu" },
  { id: "anak", label: "Pengguna di bawah umur" },
  { id: "perubahan", label: "Perubahan kebijakan" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Kebijakan privasi"
      lede="Versi ringkas: data yang kamu berikan dipakai untuk menjalankan transaksi, tidak dijual, dan bisa kamu minta hapus. Rinciannya di bawah, ditulis mengikuti Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi."
      sections={SECTIONS}
      meta={`Terakhir diperbarui ${PRIVACY_UPDATED}`}
    >
      <LegalSection id="pengendali" title="Siapa pengendali datanya">
        <p>
          Pengendali data pribadi di layanan ini adalah{" "}
          <strong>{OPERATOR.entity.trim() || "[nama badan hukum belum diisi]"}</strong>
          {OPERATOR.address.trim() ? `, beralamat di ${OPERATOR.address}` : ""}. Permintaan salinan,
          koreksi, atau penghapusan dikirim ke{" "}
          <strong>{OPERATOR.email.trim() || "[alamat pengaduan belum diisi]"}</strong>
          {OPERATOR.phone.trim() ? ` atau ${OPERATOR.phone}` : ""}. Kami akan meminta kamu
          membuktikan kepemilikan akun sebelum memprosesnya.
        </p>
      </LegalSection>

      <LegalSection id="data" title="Data yang kami kumpulkan">
        <ul>
          <li>
            <strong>Akun:</strong> email, nama pengguna, dan kata sandi (disimpan sebagai hash).
            Nomor WhatsApp bila kamu memverifikasinya, dan identitas dasar dari Google atau Discord
            bila kamu memilih masuk lewat mereka.
          </li>
          <li>
            <strong>Verifikasi penjual (KYC):</strong> nama lengkap, kota, foto identitas, dan
            swafoto — hanya untuk akun yang membuka toko, dengan persetujuan eksplisit darimu.
          </li>
          <li>
            <strong>Pesanan:</strong> isi pesanan dan riwayatnya, username Roblox atau tautan
            gamepass tujuan, catatan, dan percakapan di ruang pesanan. Kredensial login yang kamu
            berikan untuk suatu pesanan disimpan terenkripsi.
          </li>
          <li>
            <strong>Pembayaran &amp; dompet:</strong> metode dan status pembayaran, mutasi saldo,
            serta nama bank dan nomor rekening untuk penarikan penjual. Kami tidak menyimpan nomor
            kartu.
          </li>
          <li>
            <strong>Lainnya:</strong> daftar keinginan, ulasan, notifikasi, dan jejak audit tindakan
            admin (termasuk alamat IP petugas) agar perubahan data bisa ditelusuri.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="tujuan" title="Cara kami memakainya">
        <ul>
          <li>
            <strong>Menjalankan layanan:</strong> akun, pesanan, penahanan dan pelepasan dana,
            notifikasi, serta penyelesaian sengketa — tidak mungkin dilewati bila kamu ingin
            bertransaksi.
          </li>
          <li>
            <strong>Atas persetujuanmu:</strong> verifikasi WhatsApp dan verifikasi identitas
            penjual (KYC). Persetujuan bisa ditarik, dengan konsekuensi fitur itu tidak bisa dipakai.
          </li>
          <li>
            <strong>Kewajiban hukum:</strong> menyimpan catatan transaksi sesuai jangka waktu yang
            diwajibkan bagi penyelenggara perdagangan elektronik.
          </li>
          <li>
            <strong>Kepentingan yang sah:</strong> mencegah penipuan dan menjaga keamanan sistem,
            ditimbang agar tidak melampaui hakmu.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cookie" title="Cookie">
        <p>
          Kami hanya memakai satu cookie: <strong>bloxastra_session</strong> untuk menyimpan sesi
          masuk. Cookie ini <em>httpOnly</em>, <em>SameSite=Lax</em>, dan <em>Secure</em> di
          produksi. Tidak ada cookie iklan, analitik, atau pelacak pihak ketiga — karena itu tidak
          ada banner persetujuan cookie.
        </p>
      </LegalSection>

      <LegalSection id="penerima" title="Siapa lagi yang menerima data">
        <ul>
          <li>
            <strong>Penyedia pembayaran (Tripay)</strong> — nama, email, nomor WhatsApp, tagihan,
            dan kode pesanan untuk memproses pembayaran.
          </li>
          <li>
            <strong>Google dan Discord</strong> — hanya bila kamu memilih masuk dengan akun mereka.
          </li>
          <li>
            <strong>Pengirim kode WhatsApp</strong> — nomor tujuan dan isi pesan kode verifikasi.
          </li>
          <li>
            <strong>Discord milik penjual,</strong> bila penjual menyalakan webhook-nya — ringkasan
            pesanan yang masuk dikirim ke server Discord mereka.
          </li>
          <li>
            <strong>Penyedia hosting</strong> yang menyimpan basis data dan berkas aplikasi.
          </li>
        </ul>
        <p>
          Kredensial pesanan tidak dikirim ke luar alur pesanan, dan data pribadi tidak kami jual.
        </p>
      </LegalSection>

      <LegalSection id="retensi" title="Berapa lama disimpan dan bagaimana diamankan">
        <ul>
          <li>
            Catatan transaksi keuangan disimpan minimal <strong>{RETENTION.financial}</strong> dan
            transaksi non-keuangan minimal <strong>{RETENTION.nonFinancial}</strong>, sesuai
            kewajiban penyelenggara perdagangan elektronik. Sisanya dihapus saat akun dihapus atau
            sudah tidak diperlukan.
          </li>
          <li>
            Kode verifikasi WhatsApp disimpan sebagai hash, berlaku {RETENTION.otpMinutes} menit.
          </li>
          <li>
            Kata sandi disimpan sebagai hash; kredensial pesanan dienkripsi AES-256-GCM dengan kunci
            yang tidak ikut tersimpan di basis data.
          </li>
          <li>
            Setiap tindakan admin terhadap pesanan, dompet, atau data pengguna tercatat di jejak
            audit. Bila terjadi kebocoran yang berisiko bagimu, kami memberi tahu kamu dan pihak
            berwenang sesuai ketentuan.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="hak" title="Hak kamu atas datamu">
        <p>Kamu berhak untuk:</p>
        <ul>
          <li>tahu data apa yang disimpan dan mendapat salinannya;</li>
          <li>memperbaiki data yang keliru;</li>
          <li>meminta penghapusan atau penghentian pemrosesan;</li>
          <li>menarik kembali persetujuan yang pernah diberikan;</li>
          <li>membatasi pemrosesan dan memindahkan datamu sejauh sistem memungkinkan;</li>
          <li>mengadu bila hakmu dirugikan.</li>
        </ul>
        <p>
          Kirim permintaan ke kontak di bagian pertama. Catatan transaksi yang wajib disimpan
          menurut peraturan tidak bisa dihapus lebih awal; bila itu berlaku, kami akan memberi tahu
          bagian mana yang tertahan dan mengapa.
        </p>
      </LegalSection>

      <LegalSection id="anak" title="Pengguna di bawah umur">
        <p>
          Layanan ini untuk pengguna berusia minimal <strong>{OPERATOR.minAge}</strong>. Bila kamu
          orang tua atau wali dan anakmu mendaftar, hubungi kami — akun dan datanya kami hapus,
          kecuali bagian yang wajib disimpan.
        </p>
      </LegalSection>

      <LegalSection id="perubahan" title="Perubahan kebijakan">
        <p>
          Bila ada tujuan pemrosesan atau penerima data baru, kami memberi tahu sebelum perubahan
          berlaku dan memperbarui tanggal di atas. Kamu selalu bisa berhenti memakai layanan bila
          tidak menyetujuinya.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
