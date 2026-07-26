import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewItemForm } from "./NewItemForm";

export default async function NewItemPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  return (
    <Container size="sm">
      <PageTitle>Ajouter un objet</PageTitle>
      <Card className="mt-6 p-6">
        <NewItemForm />
      </Card>
    </Container>
  );
}
