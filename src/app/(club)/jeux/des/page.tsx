import Link from "next/link";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { DiceRoller } from "./DiceRoller";

export default function DesPage() {
  return (
    <Container size="md">
      <Link href="/jouer" className="text-sm font-medium text-muted hover:text-ink">
        ← Jouer
      </Link>
      <div className="mt-2">
        <PageTitle section="jeux">Lancer de dés</PageTitle>
      </div>
      <div className="mt-8">
        <DiceRoller />
      </div>
    </Container>
  );
}
