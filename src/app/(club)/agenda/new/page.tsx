import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewClubEventForm } from "./NewClubEventForm";

export default function NewClubEventPage() {
  return (
    <Container>
      <PageTitle>Ajouter un évènement</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Une grande étape à marquer sur l&apos;agenda du club — un anniversaire, un weekend, une
        fête. Visible de tous, mais ça ne touche jamais aux agendas personnels de chacun.
      </p>

      <Card className="mt-6 p-5">
        <NewClubEventForm />
      </Card>
    </Container>
  );
}
