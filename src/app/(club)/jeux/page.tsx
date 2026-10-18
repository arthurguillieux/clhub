import Link from "next/link";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { getSession } from "@/core/auth/session";
import { hasKillerAccess } from "@/modules/killer/access";

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
  {
    href: "/jeux/buzzer",
    icon: "🔔",
    name: "Buzzer",
    description: "Un QR code à scanner, et chaque téléphone devient un buzzer pour vos quizz.",
  },
];

// Only listed for members who already entered its password — the others shouldn't even guess it exists.
const KILLER = {
  href: "/jeux/killer",
  icon: "🎯",
  name: "Killer",
  description: "Des agents, des missions secrètes, une cible à éliminer — et un grand écran qui suit la partie.",
};

export default async function JeuxPage() {
  const session = await getSession();
  const tools = session && (await hasKillerAccess(session.member.id)) ? [...TOOLS, KILLER] : TOOLS;

  return (
    <Container size="md">
      <PageTitle>Jeux</PageTitle>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
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
