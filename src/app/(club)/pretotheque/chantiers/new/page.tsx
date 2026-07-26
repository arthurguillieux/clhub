import { getSession } from "@/core/auth/session";
import { listItems } from "@/modules/pretotheque/data/items";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const items = await listItems({ status: "available" });

  return (
    <Container>
      <PageTitle>Nouveau chantier</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Un seul message, plusieurs objets — chaque propriétaire reçoit sa propre demande
        pour les mêmes dates, et tu suis l&apos;ensemble depuis « Mon activité ».
      </p>

      <Card className="mt-6 p-5">
        <NewProjectForm
          items={items.map((it) => ({
            id: it.id,
            name: it.name,
            category: it.category,
            ownerName: it.ownerName,
          }))}
        />
      </Card>
    </Container>
  );
}
