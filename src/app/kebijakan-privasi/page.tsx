import type { Metadata } from "next";
import { LegalPage, LegalSection, type LegalSectionRef } from "@/components/site/legal-page";
import { OPERATOR, RETENTION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Kebijakan privasi",
  description:
    "Data apa yang dikumpulkan Blox Astra, untuk apa, siapa yang menerimanya, berapa lama disimpan, dan bagaimana kamu bisa meminta penghapusan.",
  alternates: { canonical: "/kebijakan-privasi" },
};

const SECTIONS: LegalSectionRef[] = [
  { id: "pengendali", label: "Pengendali data" },
  { id: "data", label: "Data yang dikumpulkan" },
  { id: "tujuan", label: "Tujuan dan dasar" },
  { id: "cookie", label: "Cookie" },
  { id: "penerima", label: "Pihak yang menerima" },
  { id: "retensi", label: "Lama penyimpanan" },
  { id: "keamanan", label: "Pengamanan" },
  { id: "hak", label: "Hak kamu" },
  { id: "anak", label: "Pengguna di bawah umur" },
  { id: "perubahan", label: "Perubahan kebijakan" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Kebijakan privasi"
      lede="Halaman ini menjelaskan data apa yang Blox Astra kumpulkan saat kamu memakai layanan ini, untuk apa data itu dipakai, siapa lagi yang menerimanya, berapa lama kami menyimpannya, dan apa yang bisa kamu minta kami lakukan terhadapnya. Ditulis mengikuti Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi."
      sections={SECTIONS}
    >
      <LegalSection id="pengendali" title="Siapa yang mengendalikan datamu">
        <p>
          Pengendali data pribadi di layanan ini adalah{" "}
          <strong>{OPERATOR.entity.trim() || "[nama badan hukum belum diisi]"}</strong>
          {OPERATOR.address.trim() ? `, beralamat di ${OPERATOR.address}` : ""}.
        </p>
        <p>
          Permintaan terkait data pribadi — termasuk permintaan salinan, koreksi, atau penghapusan —
          dikirim ke{" "}
          <strong>{OPERATOR.email.trim() || "[alamat pengaduan belum diisi]"}</strong>
          {OPERATOR.phone.trim() ? ` atau ${OPERATOR.phone}` : ""}. Permintaan bisa dikirim secara
          elektronik atau tertulis, dan kami akan meminta kamu membuktikan bahwa kamu pemilik akun
          sebelum memprosesnya.
        </p>
      </LegalSection>

      <LegalSection id="data" title="Data yang kami kumpulkan">
        <h3>Data akun</h3>
        <ul>
          <li>Alamat email dan nama pengguna — keduanya unik dan dipakai untuk masuk.</li>
          <li>Kata sandi, yang kami simpan hanya sebagai hash. Kami tidak pernah menyimpan kata sandi aslinya.</li>
          <li>
            Nomor WhatsApp dan status verifikasinya, bila kamu memakai verifikasi WhatsApp. Kode
            verifikasi disimpan hanya sebagai hash dan berlaku {RETENTION.otpMinutes} menit.
          </li>
          <li>Foto profil, bila kamu mengunggahnya.</li>
          <li>
            Identitas dari penyedia masuk pihak ketiga (Google atau Discord), bila kamu memilih
            masuk dengan cara itu: ID akun di penyedia tersebut, nama, email, dan URL foto profil yang
            mereka kirimkan.
          </li>
        </ul>

        <h3>Data verifikasi penjual (KYC)</h3>
        <p>
          Hanya untuk akun yang membuka toko: nama lengkap, kota, foto kartu identitas, dan swafoto.
          Ini termasuk data pribadi yang bersifat spesifik, jadi kami memprosesnya dengan dasar
          persetujuan eksplisit darimu, bukan sekadar karena kamu memakai layanan.
        </p>

        <h3>Data pesanan</h3>
        <ul>
          <li>
            Isi pesanan: produk, jumlah, harga, kode pesanan, dan statusnya dari waktu ke waktu
            beserta riwayat perubahannya.
          </li>
          <li>
            Username Roblox tujuan, tautan gamepass, dan catatan yang kamu tulis sendiri untuk
            penjual.
          </li>
          <li>
            Untuk pesanan yang memerlukan kredensial: data login yang kamu berikan. Data ini
            dienkripsi sebelum disimpan, dan hanya dibuka saat penjual membutuhkannya untuk
            menyelesaikan pesanan. Lihat bagian Pengamanan di bawah.
          </li>
          <li>
            Percakapan di dalam ruang pesanan antara kamu, penjual, dan sistem, serta pesan di grup
            penjual bila kamu seorang penjual.
          </li>
        </ul>

        <h3>Data pembayaran dan dompet</h3>
        <ul>
          <li>
            Metode pembayaran yang kamu pilih, jumlah tagihan, biaya layanan, dan status pembayaran.
            Kami <strong>tidak</strong> menyimpan nomor kartu atau kredensial perbankanmu; itu
            ditangani langsung oleh penyedia pembayaran.
          </li>
          <li>
            Untuk penarikan dana penjual: nama bank dan nomor rekening tujuan, karena dananya harus
            dikirim ke suatu tempat.
          </li>
          <li>Catatan mutasi dompet: jenis, jumlah, saldo setelah transaksi, dan kode pesanan terkait.</li>
        </ul>

        <h3>Data lain</h3>
        <ul>
          <li>Daftar keinginan, ulasan, dan penilaian yang kamu berikan setelah pesanan selesai.</li>
          <li>Notifikasi yang masuk ke kotak masuk akunmu beserta status bacanya.</li>
          <li>
            Jejak audit tindakan admin — termasuk alamat IP petugas — supaya setiap perubahan pada
            pesanan, dompet, atau data pengguna bisa ditelusuri kembali.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="tujuan" title="Tujuan dan dasar kami memprosesnya">
        <p>
          Setiap pemrosesan punya dasar yang jelas. Kami tidak memakai datamu untuk hal di luar
          daftar ini.
        </p>
        <ul>
          <li>
            <strong>Menjalankan kontrak.</strong> Membuat akun, memproses pesanan, menahan dan
            melepas dana, mengirim notifikasi, dan menangani perbedaan pendapat antara pembeli dan
            penjual. Ini pemrosesan yang tidak bisa dihindari kalau kamu ingin bertransaksi.
          </li>
          <li>
            <strong>Persetujuan eksplisit.</strong> Verifikasi identitas penjual (KYC) dan
            verifikasi nomor WhatsApp. Kamu bisa menarik persetujuan ini, tapi konsekuensinya kamu
            tidak bisa lagi berjualan atau memakai fitur yang membutuhkannya.
          </li>
          <li>
            <strong>Kewajiban hukum.</strong> Menyimpan catatan transaksi keuangan sesuai jangka
            waktu yang diwajibkan peraturan bagi penyelenggara perdagangan elektronik, dan
            menyediakan layanan pengaduan konsumen.
          </li>
          <li>
            <strong>Kepentingan yang sah.</strong> Mencegah penipuan, menindak akun yang menyalahgunakan
            layanan, dan menjaga keamanan sistem. Kepentingan ini kami timbang agar tidak melampaui
            hakmu.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cookie" title="Cookie">
        <p>
          Kami hanya memakai satu cookie: <strong>bloxastra_session</strong>, yang berfungsi
          menyimpan sesi masuk kamu. Cookie ini bersifat <em>httpOnly</em>, artinya tidak bisa
          dibaca skrip di halaman, memakai <em>SameSite=Lax</em>, dan otomatis ditandai{" "}
          <em>Secure</em> di lingkungan produksi sehingga hanya dikirim lewat HTTPS.
        </p>
        <p>
          <strong>Tidak ada cookie analitik, iklan, atau pelacak pihak ketiga</strong> di layanan
          ini. Karena itu kami juga tidak menampilkan banner persetujuan cookie: tidak ada yang perlu
          kamu setujui di luar cookie sesi yang memang diperlukan agar kamu tetap masuk.
        </p>
      </LegalSection>

      <LegalSection id="penerima" title="Siapa lagi yang menerima datamu">
        <ul>
          <li>
            <strong>Penyedia pembayaran (Tripay).</strong> Menerima data yang diperlukan untuk
            memproses pembayaran, seperti nama, email, nomor WhatsApp (untuk kanal tertentu),
            jumlah tagihan, kode pesanan, dan metode yang kamu pilih.
            Pemrosesan pembayaran bisa melibatkan sistem di luar Indonesia.
          </li>
          <li>
            <strong>Penyedia masuk pihak ketiga (Google, Discord).</strong> Hanya kalau kamu memilih
            masuk dengan akun mereka. Mereka tahu bahwa kamu memakai Blox Astra, dan kami menerima
            identitas dasar darimu dari mereka.
          </li>
          <li>
            <strong>Penyedia pengiriman kode WhatsApp.</strong> Menerima nomor WhatsApp tujuan saat
            kamu memverifikasi nomor, dan isi pesan kode verifikasi.
          </li>
          <li>
            <strong>Discord milik penjual sendiri.</strong> Penjual dapat memasang URL webhook
            Discord di toko mereka. Kalau mereka menyalakannya, ringkasan pesanan yang masuk ke
            kelompok rebutan dikirim ke server Discord milik mereka — jadi data itu keluar dari
            sistem kami dan tunduk pada kebijakan Discord serta kebijakan penjual tersebut.
          </li>
          <li>
            <strong>Penyedia hosting.</strong> Menyimpan basis data dan berkas aplikasi atas nama
            kami.
          </li>
        </ul>
        <p>
          Data kredensial pesanan tidak kami kirimkan ke pihak ketiga mana pun di luar alur pesanan.
          Kami juga tidak menjual data pribadi.
        </p>
      </LegalSection>

      <LegalSection id="retensi" title="Berapa lama kami menyimpannya">
        <p>
          Sebagai penyelenggara perdagangan elektronik, kami diwajibkan menyimpan catatan transaksi:
        </p>
        <ul>
          <li>
            Data dan informasi transaksi keuangan disimpan minimal <strong>{RETENTION.financial}</strong>.
          </li>
          <li>
            Data dan informasi transaksi non-keuangan disimpan minimal{" "}
            <strong>{RETENTION.nonFinancial}</strong>.
          </li>
        </ul>
        <p>
          Kode verifikasi WhatsApp dihapus setelah {RETENTION.otpMinutes} menit. Data lain yang
          tidak terikat kewajiban penyimpanan itu kami hapus ketika akunmu dihapus atau ketika sudah
          tidak diperlukan lagi untuk tujuan di atas.
        </p>
      </LegalSection>

      <LegalSection id="keamanan" title="Bagaimana kami mengamankannya">
        <ul>
          <li>
            Kata sandi disimpan sebagai hash, bukan teks biasa, sehingga kata sandi aslimu tidak
            bisa dibaca dari basis data kami.
          </li>
          <li>
            Data kredensial pesanan dienkripsi dengan AES-256-GCM sebelum disimpan, memakai kunci
            yang hanya ada di server dan tidak ikut tersimpan di basis data. Format simpanannya
            memuat versi, <em>initialization vector</em>, dan <em>authentication tag</em>, sehingga
            perubahan sekecil apa pun pada data terenkripsi akan terdeteksi.
          </li>
          <li>Kode verifikasi WhatsApp disimpan sebagai hash SHA-256 dan kedaluwarsa dalam {RETENTION.otpMinutes} menit.</li>
          <li>
            Setiap tindakan admin terhadap pesanan, dompet, atau data pengguna dicatat di jejak
            audit beserta identitas petugas dan alamat IP-nya.
          </li>
        </ul>
        <p>
          Tidak ada sistem yang kebal. Kalau terjadi kegagalan pelindungan data pribadi yang
          berisiko bagimu, kami akan memberitahukannya kepadamu dan kepada pihak berwenang sesuai
          ketentuan yang berlaku.
        </p>
      </LegalSection>

      <LegalSection id="hak" title="Hak kamu atas datamu">
        <p>Undang-Undang Pelindungan Data Pribadi memberi kamu hak untuk:</p>
        <ul>
          <li>mendapat keterangan tentang identitas kami, dasar kepentingan, dan tujuan pemrosesan;</li>
          <li>melengkapi atau memperbarui data yang keliru tentang dirimu;</li>
          <li>mendapat akses dan salinan data pribadimu yang kami simpan;</li>
          <li>mengakhiri pemrosesan, menghapus, atau memusnahkan data pribadimu;</li>
          <li>menarik kembali persetujuan yang pernah kamu berikan;</li>
          <li>menolak keputusan yang dibuat sepenuhnya secara otomatis;</li>
          <li>membatasi pemrosesan, dan mengajukan gugatan bila hakmu dirugikan;</li>
          <li>memindahkan datamu ke penyedia lain sejauh sistem kami memungkinkan.</li>
        </ul>
        <p>
          Kirim permintaanmu ke kontak di bagian pertama. Perlu kamu tahu: hak penghapusan bisa
          terhalang pada catatan transaksi yang wajib kami simpan menurut peraturan, dan pada data
          yang masih diperlukan untuk menyelesaikan sengketa atau pesanan yang belum tuntas. Bila
          itu terjadi, kami akan memberi tahu bagian mana yang tertahan dan mengapa.
        </p>
      </LegalSection>

      <LegalSection id="anak" title="Pengguna di bawah umur">
        <p>
          Layanan ini ditujukan untuk pengguna berusia minimal{" "}
          <strong>{OPERATOR.minAge}</strong>. Kami tidak dengan sengaja mengumpulkan data pribadi
          dari anak di bawah usia itu. Bila kamu orang tua atau wali dan mengetahui anakmu
          mendaftar, hubungi kontak di atas dan kami akan menghapus akunnya beserta datanya, kecuali
          bagian yang wajib kami simpan.
        </p>
      </LegalSection>

      <LegalSection id="perubahan" title="Perubahan kebijakan">
        <p>
          Kalau isi kebijakan ini berubah — misalnya ada tujuan pemrosesan baru atau penerima data
          baru — kami akan memberi tahu kamu lebih dulu sebelum perubahan itu berlaku, bukan
          sesudahnya, dan tanggal di bagian atas halaman ini akan diperbarui. Kamu selalu bisa
          berhenti memakai layanan bila tidak menyetujui perubahan tersebut.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
