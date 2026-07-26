import { notFound } from "next/navigation";
import { db } from "@/core/db/client";
import { findInvitationByToken } from "@/core/auth/invitations";
import { Card } from "@/core/ui/components/Card";
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
    <Card className="p-6">
      <h1 className="font-display text-xl font-extrabold text-ink">Bienvenue au club</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">
        {`${inviterUser?.name ?? "Un membre"} t'a invité·e à rejoindre le club. Confirme ton adresse pour recevoir ton lien de connexion.`}
      </p>
      <SignInForm defaultEmail={invitation.email} />
    </Card>
  );
}
