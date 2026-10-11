import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProfileView } from "@/lib/profile";
import { isOAuthConfigured } from "@/lib/oauth";
import { ProfileView } from "@/components/profile/profile-view";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Profil saya",
  description: "Kelola data akun, kata sandi, dan akun tertaut Blox Astra kamu.",
};

export default function ProfilePage(props: PageProps<"/profil">) {
  return (
    <Suspense
      fallback={
        <div className="shell pb-24 pt-10 md:pt-14">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-80 w-full rounded-card" />
        </div>
      }
    >
      <ProfileContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ProfileContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/masuk");
  }
  const [profile, params] = await Promise.all([getProfileView(user.id), searchParams]);
  if (!profile) {
    redirect("/masuk");
  }
  const linked = typeof params.linked === "string" ? params.linked : null;
  const linkError = typeof params.link_error === "string" ? params.link_error : null;
  return (
    <ProfileView
      profile={profile}
      linkNotice={{ linked, linkError }}
      linkable={{ google: isOAuthConfigured("google"), discord: isOAuthConfigured("discord") }}
    />
  );
}
