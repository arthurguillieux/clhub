import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { DiceRoller } from "./DiceRoller";

export default function DesPage() {
  return (
    <Container size="md">
      <PageTitle>Jeux</PageTitle>
      <div className="mt-8">
        <DiceRoller />
      </div>
    </Container>
  );
}
