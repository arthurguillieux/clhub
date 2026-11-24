import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { Header } from "@/core/ui/components/Header";
import { BackToTop } from "@/core/ui/components/BackToTop";
import { BottomNav } from "@/core/ui/components/BottomNav";
import { MayThe4thBanner } from "@/core/ui/components/MayThe4thBanner";
import { AdminModeBanner } from "@/core/ui/components/AdminModeBanner";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <Header user={session.user} />
      <AdminModeBanner />
      <MayThe4thBanner />
      {/* Room under the content for the phone's shortcut bar. */}
      <div className="pb-28 md:pb-0">{children}</div>
      <BackToTop />
      <BottomNav />
    </>
  );
}
