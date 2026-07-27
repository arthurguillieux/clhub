import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewRecipeForm } from "./NewRecipeForm";

export default function NewRecipePage() {
  return (
    <Container>
      <PageTitle>Proposer une recette</PageTitle>
      <p className="mt-2 text-sm text-muted">Elle rejoindra le carnet commun, visible de tous.</p>

      <Card className="mt-6 p-5">
        <NewRecipeForm />
      </Card>
    </Container>
  );
}
