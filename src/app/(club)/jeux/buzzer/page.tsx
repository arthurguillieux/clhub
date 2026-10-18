import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { Button } from "@/core/ui/components/Button";
import { listRoomsByHost } from "@/modules/jeux/data/buzzerRooms";
import { createGameAction } from "@/app/(buzzer)/buzzer/actions";

const STEPS = [
  "Tu lances une partie : un QR code apparaît sur ton écran.",
  "Chacun scanne le QR code avec son téléphone, choisit un nom d'équipe et un animal — pas besoin de compte.",
  "Tu ouvres les buzzers : la première équipe qui appuie bloque les autres, et tu valides sa réponse.",
];

export default async function BuzzerPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const running = listRoomsByHost(session.member.id);

  return (
    <Container size="sm">
      <Link href="/jeux" className="text-sm font-medium text-muted hover:text-ink">
        ← Jeux
      </Link>
      <div className="mt-2">
        <PageTitle>Buzzer</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        Un quizz, un blindtest, une soirée : chaque téléphone devient un buzzer.
      </p>

      <Card className="mt-6 p-5">
        <ol className="flex flex-col gap-3 text-sm text-ink">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="glow-text-primary font-display font-extrabold text-primary">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <form action={createGameAction} className="mt-5">
          <Button type="submit" variant="accent">
            Lancer une nouvelle partie
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted">
          Une partie vit dans la mémoire du site : si le site est mis à jour pendant que tu joues, elle s&apos;arrête.
        </p>
      </Card>

      {running.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Tes parties en cours</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {running.map((room) => (
              <Card key={room.code} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono text-sm font-semibold tracking-widest text-ink">{room.code}</p>
                  <p className="text-xs text-muted">
                    {room.state.teams.length} {room.state.teams.length === 1 ? "équipe" : "équipes"} ·{" "}
                    {room.state.started ? "quizz en cours" : "en attente des équipes"}
                  </p>
                </div>
                <Link href={`/buzzer/${room.code}/animateur`} className="text-sm font-semibold text-primary hover:underline">
                  Reprendre
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
