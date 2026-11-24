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
  {
    href: "/jeux/buzzer",
    icon: "🔔",
    name: "Buzzer",
    description: "Un QR code à scanner, et chaque téléphone devient un buzzer pour vos quizz.",
  },
  {
    href: "/jeux/killer",
    icon: "🎯",
    name: "Killer",
    description: "Des agents, des missions secrètes, une cible à éliminer — et un grand écran qui suit la partie.",
  },
  {
    href: "/jeux/loups",
    icon: "🐺",
    name: "Loups-garous",
    description: "L'aide du meneur : le deck selon le nombre de joueurs, les cartes tirées au sort, les appels de la nuit et la mémoire de la partie.",
  },
  {
    href: "/jeux/santa",
    icon: "🎁",
    name: "Secret Santa",
    description: "Le tirage au sort des cadeaux, avec tes règles, un lien perso pour chacun et ses idées de cadeaux.",
  },
  {
    href: "/jeux/lettre",
    icon: "💌",
    name: "Ma lettre au Père Noël",
    description: "La liste de Noël d'un enfant pour toute la famille : un seul lien, chacun réserve ce qu'il offre, et une cagnotte pour le gros cadeau.",
  },
];

export default function JeuxPage() {
  const tools = TOOLS;

  return (
    <Container size="md">
      <PageTitle section="jeux">Jeux</PageTitle>

      {/* Two by two on a phone: the name and its emoji read at a glance, the rest one tap away. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-[#ffcc29] sm:p-5">
              <span aria-hidden="true" className="text-3xl">
                {tool.icon}
              </span>
              <p className="font-display text-base font-extrabold text-ink sm:text-lg">{tool.name}</p>
              <p className="line-clamp-3 text-xs text-muted sm:text-sm">{tool.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
