import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { hasKillerAccess } from "@/modules/killer/access";
import { listGamesByHost } from "@/modules/killer/data/games";
import { createKillerDemoAction, createKillerGameAction } from "@/app/(killer)/killer/actions";
import { DeleteGameButton } from "./DeleteGameButton";
import { UnlockForm } from "./UnlockForm";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATUS_LABELS: Record<string, string> = {
  lobby: "en préparation",
  running: "en cours",
  ended: "terminée",
};

export default async function KillerHomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  if (!(await hasKillerAccess(session.member.id))) {
    return (
      <Container size="sm">
        <PageTitle>Accès réservé</PageTitle>
        <p className="mt-2 text-sm text-muted">Ce jeu est protégé par un mot de passe.</p>
        <Card className="mt-6 p-5">
          <UnlockForm />
        </Card>
      </Container>
    );
  }

  const games = await listGamesByHost(session.member.id);

  return (
    <Container size="sm">
      <Link href="/jeux" className="text-sm font-medium text-muted hover:text-ink">
        ← Jeux
      </Link>
      <div className="mt-2">
        <PageTitle>Killer</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        Tu prépares la liste des agents et leurs missions, tu affiches l&apos;écran sur la TV, chacun scanne le QR code et
        prend sa photo. Ensuite tu valides les éliminations depuis ton téléphone.
      </p>

      <Card className="mt-6 p-5">
        <form action={createKillerGameAction} className="flex flex-col gap-4">
          <FormField label="Nom de la partie" htmlFor="title">
            <Input id="title" name="title" placeholder="Halloween 2026" maxLength={80} />
          </FormField>
          <Button type="submit" variant="accent" className="self-start">
            Préparer une nouvelle partie
          </Button>
        </form>
        <form action={createKillerDemoAction} className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-muted">
            Pour voir à quoi ça ressemble : une partie « Test » avec 12 agents inventés et leurs missions, dont 2 places
            libres pour essayer depuis ton téléphone. Elle remplace la partie Test précédente.
          </p>
          <Button type="submit" variant="ghost" className="mt-2">
            Créer une partie Test
          </Button>
        </form>
      </Card>

      {games.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Tes parties</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {games.map((g) => (
              <Card key={g.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display font-bold text-ink">{g.title}</p>
                    <p className="text-xs text-muted">
                      Code {g.code} · {STATUS_LABELS[g.status] ?? g.status}
                    </p>
                  </div>
                  <Link href={`/killer/${g.code}/panneau`} className="-my-2.5 py-2.5 text-sm font-semibold text-primary hover:underline">
                    Ouvrir le panneau
                  </Link>
                </div>
                <div>
                  <DeleteGameButton code={g.code} title={g.title} />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
