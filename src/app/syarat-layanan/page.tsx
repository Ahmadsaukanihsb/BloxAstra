import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, type LegalSectionRef } from "@/components/site/legal-page";
import { ESCROW_WINDOWS, OFFSITE, OPERATOR, PAYMENT_METHODS_LEGAL, WITHDRAWAL_FEE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Syarat layanan",
  description:
    "Aturan pemakaian Blox Astra: peran platform, cara dana ditahan dan dilepas, pembatalan dan pengembalian dana, kewajiban penjual dan pembeli, serta cara menyelesaikan sengketa.",
  alternates: { canonical: "/syarat-layanan" },
};

const SECTIONS: LegalSectionRef[] = [
  { id: "tentang", label: "Tentang layanan ini" },
  { id: "akun", label: "Akun kamu" },
  { id: "peran", label: "Peran kami" },
  { id: "bayar", label: "Pembayaran" },
  { id: "dana", label: "Penahanan dan pelepasan dana" },
  { id: "refund", label: "Pembatalan dan pengembalian dana" },
  { id: "penjual", label: "Kewajiban penjual" },
  { id: "pembeli", label: "Kewajiban pembeli" },
  { id: "larangan", label: "Yang dilarang" },
  { id: "sengketa", label: "Sengketa" },
  { id: "tanggung-jawab", label: "Batas tanggung jawab" },
  { id: "hukum", label: "Hukum dan perubahan" },
  { id: "pengaduan", label: "Pengaduan" },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Syarat layanan"
      lede="Ini perjanjian antara kamu dan Blox Astra tentang cara memakai layanan ini. Isinya menjelaskan apa yang kami lakukan dengan uangmu, apa yang kamu dan penjual harus lakukan, dan bagaimana kami menyelesaikan masalah. Dibuat mengikuti ketentuan perdagangan elektronik yang berlaku di Indonesia."
      sections={SECTIONS}
    >
      <LegalSection id="tentang" title="Tentang layanan ini">
        <p>
          Blox Astra adalah platform yang mempertemukan pembeli dengan penjual Robux, item, gift
          card, dan langganan Premium Roblox. Kami bukan penjualnya. Yang menjual dan menyerahkan
          barang adalah penjual yang membuka toko di platform ini.
        </p>
        <p>{OFFSITE.robloxNotAffiliated}</p>
        <p>
          Layanan ini dijalankan oleh{" "}
          <strong>{OPERATOR.entity.trim() || "[nama badan hukum belum diisi]"}</strong>, dan
          terdaftar sebagai Penyelenggara Sistem Elektronik dengan nomor tanda daftar{" "}
          <strong>{OPERATOR.pseNumber.trim() || "[nomor PSE belum diisi]"}</strong>.
        </p>
      </LegalSection>

      <LegalSection id="akun" title="Akun kamu">
        <ul>
          <li>
            Kamu harus memberi data yang benar dan menjaganya tetap benar. Data palsu membuat kami
            tidak bisa menyelesaikan sengketa maupun mengembalikan dana kepadamu.
          </li>
          <li>
            Usia minimum untuk memakai layanan ini adalah <strong>{OPERATOR.minAge}</strong>.
          </li>
          <li>
            Jaga kerahasiaan kata sandimu. Semua tindakan yang dilakukan dari akunmu dianggap
            berasal darimu, kecuali kamu bisa membuktikan akunmu diambil alih.
          </li>
          <li>
            Satu orang satu akun. Kami bisa menolak, membatasi, atau menutup akun yang melanggar
            ketentuan ini, dan bila ada dana di dalamnya kami akan menyelesaikannya lebih dulu
            sebelum menutup akun.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="peran" title="Peran kami">
        <p>
          Kami menyediakan tempat, menahan dana, dan menengahi bila terjadi masalah. Kami tidak
          menjamin mutu barang yang dijual penjual, dan kami tidak bisa memaksa penjual merespons
          lebih cepat daripada yang mereka sanggupi.
        </p>
        <p>
          Yang kami jamin ada tiga hal, dan ketiganya bekerja otomatis lewat sistem, bukan lewat
          janji: <strong>dana pembeli ditahan</strong> sampai pesanan selesai atau dikembalikan,{" "}
          <strong>penjual harus melewati verifikasi identitas</strong> sebelum boleh berjualan, dan{" "}
          <strong>pesanan yang tidak bergerak akan dikembalikan otomatis</strong> sesuai tenggat di
          bagian berikutnya — kamu tidak perlu menagih.
        </p>
      </LegalSection>

      <LegalSection id="bayar" title="Pembayaran">
        <p>Metode pembayaran yang tersedia beserta biaya yang menyertainya:</p>
        <ul>
          {PAYMENT_METHODS_LEGAL.map((method) => (
            <li key={method.label}>
              <strong>{method.label}</strong> — {method.fee}.
            </li>
          ))}
        </ul>
        <p>
          Pembayaran diproses oleh penyedia pembayaran pihak ketiga. Sebagian metode punya jendela
          pembayaran terbatas; kalau jendela itu lewat, pesanan dibatalkan otomatis dan kamu tidak
          terpotong apa pun. Harga yang berlaku adalah harga yang tertera di halaman pembayaran saat
          kamu menyelesaikan transaksi.
        </p>
      </LegalSection>

      <LegalSection id="dana" title="Penahanan dan pelepasan dana">
        <p>
          Uang yang kamu bayarkan tidak langsung masuk ke penjual. Dana ditahan oleh platform, dan
          baru dilepas kepada penjual ketika salah satu dari ini terjadi:
        </p>
        <ul>
          <li>kamu sendiri menekan tombol konfirmasi setelah barang kamu terima; atau</li>
          <li>
            jendela konfirmasi habis tanpa kamu menekan apa pun. Jendela ini punya bawaan 24 jam,
            penjual bisa menyetelnya berbeda per listing, dan angka yang berlaku untuk pesananmu
            selalu tercantum di halaman pesanan itu.
          </li>
        </ul>
        <p>
          Kami juga mengembalikan dana secara otomatis bila pesanan macet tanpa kamu harus meminta:
        </p>
        <ul>
          <li>
            Orderan kelompok rebutan yang sudah dibayar tetapi tidak diambil penjual mana pun dalam{" "}
            <strong>{ESCROW_WINDOWS.poolHours} jam</strong>.
          </li>
          <li>
            Orderan yang sudah diambil penjual tetapi tidak mulai dikerjakan dalam{" "}
            <strong>{ESCROW_WINDOWS.assignedHours} jam</strong>.
          </li>
          <li>
            Orderan yang berstatus diproses tetapi tidak bergerak sama sekali selama{" "}
            <strong>{ESCROW_WINDOWS.processingDays} hari</strong>.
          </li>
        </ul>
        <p>
          Penjual mencairkan penghasilannya lewat permintaan penarikan. Biaya penarikan{" "}
          {WITHDRAWAL_FEE} per permintaan, dan dananya dikirim ke rekening bank yang penjual
          daftarkan.
        </p>
      </LegalSection>

      <LegalSection id="refund" title="Pembatalan dan pengembalian dana">
        <ul>
          <li>
            Pesanan yang belum dibayar bisa dibatalkan tanpa biaya apa pun, dan jendela
            pembayarannya memang akan habis dengan sendirinya.
          </li>
          <li>
            Pesanan yang sudah dibayar dan dikembalikan otomatis akan dikembalikan ke saldo akunmu
            di Blox Astra. Kamu bisa memakainya untuk pesanan lain, atau menariknya.
          </li>
          <li>
            Untuk barang yang tidak sesuai, tidak dikirim, atau cacat, ajukan sengketa seperti pada
            bagian Sengketa. Bila sengketa dimenangkan, dananya kembali penuh kepadamu.
          </li>
          <li>
            Waktu proses pengembalian dana bergantung pada penyedia pembayaran bila dananya harus
            kembali ke rekening atau e-wallet asal.
          </li>
        </ul>
        <p>
          Ketentuan di atas mengatur cara kerja platform ini. Itu <strong>tidak mengurangi hakmu</strong>{" "}
          yang diberikan hukum perlindungan konsumen, termasuk hak atas informasi yang benar, hak
          didengar, dan hak atas ganti rugi bila kamu memang dirugikan.
        </p>
      </LegalSection>

      <LegalSection id="penjual" title="Kewajiban penjual">
        <ul>
          <li>
            Menjalani verifikasi identitas sebelum berjualan, dan menjaga data verifikasi itu tetap
            benar. Verifikasi bisa ditolak atau diminta diulang bila dokumennya tidak jelas.
          </li>
          <li>Menyerahkan barang sesuai yang dijanjikan di listing, dalam waktu yang wajar.</li>
          <li>
            Menyelesaikan pesanan yang sudah diambil. Membiarkan pesanan menggantung bukan pilihan
            yang netral: dananya kembali ke pembeli, dan itu tercatat pada tingkat penyelesaian
            tokonya.
          </li>
          <li>
            Tidak meminta pembeli membayar di luar platform. Pembayaran di luar platform tidak
            dilindungi penahanan dana, dan itu pelanggaran yang bisa berujung penutupan toko.
          </li>
          <li>
            Bila penjual memasang webhook Discord, penjual bertanggung jawab atas server Discord
            tujuannya dan atas siapa saja yang bisa membaca pesan di sana.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="pembeli" title="Kewajiban pembeli">
        <ul>
          <li>
            Menuliskan username Roblox dan tautan gamepass dengan benar. Barang yang dikirim ke
            username yang kamu tulis sendiri dianggap terkirim dengan benar.
          </li>
          <li>
            Untuk pesanan yang memerlukan kredensial, masukkan hanya lewat formulir di dalam
            pesanan. Jangan pernah mengirim kata sandi lewat chat, dan jangan mengirimkannya ke
            siapa pun di luar platform ini.
          </li>
          <li>
            Membaca deskripsi listing sebelum membeli, terutama perbedaan antara metode username,
            login, gamepass, dan pembelian lewat penjual — tenggat dan risikonya berbeda.
          </li>
          <li>Mengonfirmasi pesanan setelah barang benar-benar diterima.</li>
        </ul>
      </LegalSection>

      <LegalSection id="larangan" title="Yang dilarang">
        <ul>
          <li>
            Menjual Robux, akun, atau item yang diperoleh dari penipuan, pencurian akun, atau cara
            melanggar ketentuan Roblox.
          </li>
          <li>Mengajukan sengketa atau pengembalian dana yang kamu tahu tidak berdasar.</li>
          <li>Menggunakan data pembayaran milik orang lain tanpa izin.</li>
          <li>
            Mengajak pembeli atau penjual bertransaksi di luar platform untuk menghindari biaya
            layanan atau penahanan dana.
          </li>
          <li>
            Menyalahgunakan sistem dengan cara otomatis, termasuk membuat banyak akun untuk
            memanipulasi penilaian, stok, atau kelompok rebutan.
          </li>
        </ul>
        <p>
          Pelanggaran bisa berakibat pembatasan akun, penutupan toko, pembatalan pesanan, atau
          pelaporan ke pihak berwenang, tergantung beratnya.
        </p>
      </LegalSection>

      <LegalSection id="sengketa" title="Sengketa">
        <p>
          Kalau barang tidak sesuai atau tidak kamu terima, buka sengketa dari halaman pesanan
          sebelum jendela konfirmasi berakhir. Kamu bisa melampirkan bukti berupa gambar.
        </p>
        <p>
          Setelah sengketa dibuka, penjual punya kesempatan menjawab. Admin memeriksa bukti dari
          kedua sisi dan mengambil satu dari dua keputusan: dana dikembalikan penuh kepadamu, atau
          dana diteruskan ke penjual. Target penanganannya <strong>{ESCROW_WINDOWS.disputeSlaHours} jam</strong>{" "}
          sejak sengketa dibuka. Sengketa yang sedang berjalan menahan dananya: tidak ada pihak yang
          bisa menariknya sebelum ada keputusan.
        </p>
      </LegalSection>

      <LegalSection id="tanggung-jawab" title="Batas tanggung jawab kami">
        <p>
          Kami bertanggung jawab menjalankan platform sesuai yang dijelaskan di halaman ini: menahan
          dana, menjalankan pengembalian otomatis, dan menengahi sengketa. Selama itu berjalan
          seperti dijelaskan, kerugian yang timbul dari kelalaian penjual atau kelalaianmu sendiri
          bukan tanggung jawab kami.
        </p>
        <p>
          Namun kami <strong>tidak</strong> memakai ketentuan ini untuk mengalihkan tanggung jawab
          yang tidak boleh dialihkan menurut hukum, membatasi hakmu mengajukan gugatan atas
          wanprestasi kami sendiri, atau menolak pengembalian dana yang menjadi hakmu. Klausul dalam
          perjanjian yang mencoba menghapus hak-hak itu batal demi hukum, dan kami tidak berusaha
          memasangnya di sini.
        </p>
      </LegalSection>

      <LegalSection id="hukum" title="Hukum yang berlaku dan perubahan syarat">
        <p>
          Perjanjian ini tunduk pada hukum Indonesia. Kalau ada ketentuan di sini yang bertentangan
          dengan peraturan yang berlaku, ketentuan yang bertentangan itu tidak dipakai, dan sisanya
          tetap berlaku.
        </p>
        <p>
          Kami bisa mengubah syarat ini bila layanannya berubah. Perubahan yang mengurangi hakmu
          akan kami beritahukan lebih dulu sebelum berlaku. Kalau kamu tidak setuju, kamu bisa
          berhenti memakai layanan dan menyelesaikan transaksi yang masih berjalan.
        </p>
      </LegalSection>

      <LegalSection id="pengaduan" title="Cara menyampaikan pengaduan">
        <p>Pengaduan bisa disampaikan lewat:</p>
        <ul>
          <li>
            Alamat pengaduan:{" "}
            <strong>{OPERATOR.email.trim() || "[alamat pengaduan belum diisi]"}</strong>
          </li>
          <li>
            Nomor telepon:{" "}
            <strong>{OPERATOR.phone.trim() || "[nomor pengaduan belum diisi]"}</strong>
          </li>
          <li>Ruang pesanan atau sengketa, bila pengaduanmu menyangkut pesanan tertentu.</li>
        </ul>
        <p>
          Sertakan kode pesanan bila ada, supaya bisa ditelusuri lebih cepat. Kami menargetkan
          tanggapan pertama dalam {ESCROW_WINDOWS.disputeSlaHours} jam kerja, dan akan memberi tahu
          kamu tahapan penanganannya sampai selesai. Ketentuan data pribadi yang kami kumpulkan
          dalam proses ini dijelaskan di{" "}
          <Link href="/kebijakan-privasi">Kebijakan privasi</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
