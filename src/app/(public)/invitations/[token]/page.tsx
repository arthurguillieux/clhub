import { notFound } from "next/navigation";
import { db } from "@/core/db/client";
import { findInvitationByToken } from "@/core/auth/invitations";
import { SignInForm } from "../../sign-in/SignInForm";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await findInvitationByToken(token);

  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    notFound();
  }

  const inviterMember = await db.query.member.findFirst({
    where: (m, { eq }) => eq(m.id, invitation.invitedById),
  });
  const inviterUser = inviterMember
    ? await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, inviterMember.userId) })
    : null;

  return (
    <main style={{ maxWidth: "400px", margin: "48px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "20px" }}>Bienvenue au CLHUB</h1>
      <p style={{ color: "#555", fontSize: "14px" }}>
        {`${inviterUser?.name ?? "Un membre"} t'a invité·e à rejoindre le club. Confirme ton adresse pour recevoir ton lien de connexion.`}
      </p>
      <SignInForm defaultEmail={invitation.email} />
    </main>
  );
}
