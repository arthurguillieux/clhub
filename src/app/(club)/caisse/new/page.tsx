import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewTransactionForm } from "./NewTransactionForm";

export default function NewTransactionPage() {
  return (
    <Container>
      <PageTitle>Ajouter un mouvement</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Une contribution ajoute au pot commun, une dépense en retire — tout le monde voit le
        journal complet.
      </p>

      <Card className="mt-6 p-5">
        <NewTransactionForm />
      </Card>
    </Container>
  );
}
