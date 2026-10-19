import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSellerChat } from "@/lib/seller";
import { Skeleton } from "@/components/ui/feedback";
import { SellerChatBox } from "@/components/seller/seller-chat";
import { IconChat } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Grup seller",
  description: "Ruang obrolan bersama seluruh penjual Blox Astra: koordinasi stok, tanya ketersediaan, rebutan order.",
  robots: { index: false, follow: false },
};

export default function SellerGroupPage() {
  return (
    <Suspense
      fallback={
        <div className="shell pb-20 pt-8 md:pt-10">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-96 w-full rounded-card" />
        </div>
      }
    >
      <SellerGroupContent />
    </Suspense>
  );
}

async function SellerGroupContent() {
  await connection();
  // The seller group is seller-and-admin only. This page used `requireUser`,
  // so any signed-in buyer could open it and read the sellers' coordination
  // room (the write action already refused non-sellers, but the reads did not).
  const user = await requireUser();
  if (user.role !== "seller" && user.role !== "admin") {
    redirect("/");
  }
  const chat = await getSellerChat(user.id);

  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="flex items-center gap-2 text-[13px] text-ink-mute">
            <IconChat size={16} className="text-astra-ink" />
            Grup seller
          </span>
 <h1 className="font-display text-page font-extrabold text-ink md:text-page">
            Ruang obrolan penjual
          </h1>
          <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
            Satu ruang untuk semua penjual Blox Astra. Pakai untuk koordinasi serah terima, tanya
            stok teman seller, atau saling info order Robux yang baru masuk ke pool rebutan. Ketik
            @ lalu nama toko untuk memanggil penjual tertentu — dia dapat notifikasi di kotak
            masuknya.
          </p>
        </div>

        <SellerChatBox
          messages={chat.items}
          unread={chat.unread}
          mentionable={chat.mentionable}
          online={chat.online}
          moderator={user.role === "admin"}
        />
      </div>
    </div>
  );
}
