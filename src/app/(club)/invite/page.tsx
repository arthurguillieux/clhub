import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { listInvitations } from "@/modules/invitations/data";
import { InvitationList } from "./InvitationList";
import { InviteForm } from "./InviteForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inviter" };

export default async function InvitePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx
  const invitations = await listInvitations(session.member.id);
  const joined = invitations.filter((i) => i.status === "joined").length;

  return (
    <Container size="sm">
      <PageTitle>Inviter quelqu&apos;un</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Connecté en tant que {session.user.name} (membre #{session.member.memberNumber}). La personne reçoit un lien par mail, valable 14 jours.
      </p>
      <Card className="mt-6 p-5">
        <InviteForm />
      </Card>

      <section className="mt-8" aria-label="Tes invitations">
        <SectionTitle>Tes invitations</SectionTitle>
        {invitations.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Tu n&apos;as encore invité personne.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {invitations.length} {invitations.length > 1 ? "adresses invitées" : "adresse invitée"}, {joined} {joined > 1 ? "ont rejoint" : "a rejoint"} le CLHUB. Si quelqu&apos;un n&apos;a pas vu le mail (ou si le lien a expiré), renvoie-lui l&apos;invitation.
            </p>
            <div className="mt-3">
              <InvitationList invitations={invitations} />
            </div>
          </>
        )}
      </section>
    </Container>
  );
}
