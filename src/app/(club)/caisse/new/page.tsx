import { getSession } from "@/core/auth/session";
import { listMembersForEventForm } from "@/modules/caisse/data/events";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewEventForm } from "./NewEventForm";

export default async function NewExpenseEventPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const members = await listMembersForEventForm();

  return (
    <Container>
      <PageTitle>Nouvel évènement</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Un weekend, un camping, une soirée — regroupe les dépenses qui vont avec pour calculer qui doit
        quoi à qui ensuite.
      </p>

      <Card className="mt-6 p-5">
        <NewEventForm members={members} currentMemberId={session.member.id} />
      </Card>
    </Container>
  );
}
