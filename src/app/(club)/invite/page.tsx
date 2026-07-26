import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { InviteForm } from "./InviteForm";

export default async function InvitePage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main style={{ maxWidth: "400px", margin: "48px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "20px" }}>Inviter quelqu&apos;un au club</h1>
      <p style={{ color: "#555", fontSize: "14px" }}>
        Connecté en tant que {session.user.name} (membre #{session.member.memberNumber}).
      </p>
      <InviteForm />
    </main>
  );
}
