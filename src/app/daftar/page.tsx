import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Daftar",
  description:
    "Daftar sebagai pembeli atau penjual Blox Astra. Penjual wajib melewati verifikasi KYC manual dengan KTP dan selfie bertanggal.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div className="shell pb-24 pt-24 md:pt-28">
      <div className="bezel-shell p-1.5">
        <div className="bezel-core overflow-hidden">
          <AuthPanel mode="register" />
        </div>
      </div>
    </div>
  );
}
