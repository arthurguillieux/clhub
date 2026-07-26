import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { InviteForm } from "./InviteForm";

export default async function InvitePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  return (
    <Container size="sm">
      <PageTitle>Inviter quelqu&apos;un</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Connecté en tant que {session.user.name} (membre #{session.member.memberNumber}).
      </p>
      <Card className="mt-6 p-5">
        <InviteForm />
      </Card>
    </Container>
  );
}
