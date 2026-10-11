import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Masuk",
  description:
    "Masuk ke akun Blox Astra untuk memantau pesanan, saldo dompet, dan notifikasi transaksi.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-28 md:px-8 md:pt-36">
      <div className="bezel-shell p-1.5">
        <div className="bezel-core overflow-hidden">
          <AuthPanel mode="login" />
        </div>
      </div>
    </div>
  );
}
