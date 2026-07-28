import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { Header } from "@/core/ui/components/Header";
import { BackToTop } from "@/core/ui/components/BackToTop";
import { MayThe4thBanner } from "@/core/ui/components/MayThe4thBanner";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <Header user={session.user} />
      <MayThe4thBanner />
      {children}
      <BackToTop />
    </>
  );
}
