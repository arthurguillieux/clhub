import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { Header } from "@/core/ui/components/Header";
import { BackToTop } from "@/core/ui/components/BackToTop";
import { BottomNav } from "@/core/ui/components/BottomNav";
import { MayThe4thBanner } from "@/core/ui/components/MayThe4thBanner";
import { AdminModeBanner } from "@/core/ui/components/AdminModeBanner";
import { Toaster } from "@/core/ui/components/Toaster";
import { Suspense } from "react";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      {/* For keyboard and screen-reader users: jump straight past the header. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ground"
      >
        Aller au contenu
      </a>
      <Header user={session.user} />
      <AdminModeBanner />
      <MayThe4thBanner />
      {/* Room under the content for the phone's shortcut bar. */}
      <div id="contenu" tabIndex={-1} className="pb-28 outline-none md:pb-0">
        {children}
      </div>
      <BackToTop />
      <BottomNav />
      <Suspense>
        <Toaster />
      </Suspense>
    </>
  );
}
