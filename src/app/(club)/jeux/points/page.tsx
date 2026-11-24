import Link from "next/link";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { PointCounter } from "./PointCounter";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Compteur de points" };

export default function PointsPage() {
  return (
    <Container size="md">
      <Link href="/jouer" className="text-sm font-medium text-muted hover:text-ink">
        ← Jouer
      </Link>
      <div className="mt-2">
        <PageTitle section="jeux">Compteur de points</PageTitle>
      </div>
      <div className="mt-8">
        <PointCounter />
      </div>
    </Container>
  );
}
