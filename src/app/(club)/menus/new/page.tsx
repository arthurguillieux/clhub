import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewMenuEventForm } from "./NewMenuEventForm";

export default function NewMenuEventPage() {
  return (
    <Container>
      <PageTitle>Proposer un repas</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Les autres membres pourront dire s&apos;ils viennent et ce qu&apos;ils apportent.
      </p>

      <Card className="mt-6 p-5">
        <NewMenuEventForm />
      </Card>
    </Container>
  );
}
