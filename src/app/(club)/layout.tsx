import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { Header } from "@/core/ui/components/Header";
import { BackToTop } from "@/core/ui/components/BackToTop";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <Header user={session.user} />
      {children}
      <BackToTop />
    </>
  );
}
