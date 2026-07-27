import { requireAdmin } from "@/core/auth/admin";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <Container>
      <PageTitle>Admin</PageTitle>
      <Card className="mt-6 p-6">
        <p className="text-sm text-muted">
          Le déverrouillage fonctionne. Les outils (membres, objets, modération) arrivent
          ensuite.
        </p>
      </Card>
    </Container>
  );
}
