import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSellerChat } from "@/lib/seller";
import { Skeleton } from "@/components/ui/feedback";
import { SellerChatBox } from "@/components/seller/seller-chat";
import { IconChat } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Grup seller",
  description: "Ruang obrolan bersama seluruh penjual Blox Astra — koordinasi, tanya stok, rebutan order.",
  robots: { index: false, follow: false },
};

export default function SellerGroupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-12 md:px-8 md:pt-16">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-96 w-full rounded-3xl" />
        </div>
      }
    >
      <SellerGroupContent />
    </Suspense>
  );
}

async function SellerGroupContent() {
  await connection();
  const user = await requireUser();
  const messages = await getSellerChat(user.id);

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-12 md:px-8 md:pt-16">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="flex items-center gap-2 text-[13px] text-ink-mute">
            <IconChat size={16} className="text-astra-ink" />
            Grup seller
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-[2.1rem]">
            Ruang obrolan penjual
          </h1>
          <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
            Satu ruang untuk semua penjual Blox Astra. Pakai untuk koordinasi serah terima, tanya
            stok teman seller, atau saling info order Robux yang baru masuk ke pool rebutan.
          </p>
        </div>

        <SellerChatBox messages={messages} />
      </div>
    </div>
  );
}
