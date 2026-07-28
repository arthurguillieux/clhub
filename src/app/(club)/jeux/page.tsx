import Link from "next/link";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";

const TOOLS = [
  {
    href: "/jeux/points",
    icon: "🔢",
    name: "Compteur de points",
    description: "Des joueurs, une couleur chacun, et des points en plus ou en moins.",
  },
  {
    href: "/jeux/des",
    icon: "🎲",
    name: "Lancer de dés",
    description: "d4 à d100, un ou plusieurs à la fois.",
  },
];

export default function JeuxPage() {
  return (
    <Container size="md">
      <PageTitle>Jeux</PageTitle>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="flex h-full flex-col gap-2 p-5 transition-colors hover:border-primary">
              <span aria-hidden="true" className="text-3xl">
                {tool.icon}
              </span>
              <p className="font-display text-lg font-extrabold text-ink">{tool.name}</p>
              <p className="text-sm text-muted">{tool.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
