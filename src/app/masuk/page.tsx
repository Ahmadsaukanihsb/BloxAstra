import type { Metadata } from "next";
import { getSiteLogo } from "@/lib/site-logo";
import { AuthPanel } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Masuk",
  description:
    "Masuk ke akun Blox Astra untuk memantau pesanan, saldo dompet, dan notifikasi transaksi.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const logo = await getSiteLogo();
  return (
    <div className="shell pb-24 pt-24 md:pt-28">
      <div className="bezel-shell p-1.5">
        <div className="bezel-core overflow-hidden">
          <AuthPanel mode="login" logo={logo} />
        </div>
      </div>
    </div>
  );
}
