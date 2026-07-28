import Link from "next/link";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { PointCounter } from "./PointCounter";

export default function PointsPage() {
  return (
    <Container size="md">
      <Link href="/jeux" className="text-sm font-medium text-muted hover:text-ink">
        ← Jeux
      </Link>
      <div className="mt-2">
        <PageTitle>Compteur de points</PageTitle>
      </div>
      <div className="mt-8">
        <PointCounter />
      </div>
    </Container>
  );
}
