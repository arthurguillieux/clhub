import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { Button } from "@/core/ui/components/Button";
import { listGamesForMember } from "@/modules/killer/data/games";
import { createKillerDemoAction } from "@/app/(killer)/killer/actions";
import { DeleteGameButton } from "./DeleteGameButton";
import { CreateGameForm, JoinOrganizationForm } from "./KillerForms";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATUS_LABELS: Record<string, string> = {
  lobby: "en préparation",
  running: "en cours",
  ended: "terminée",
};

export default async function KillerHomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const all = await listGamesForMember(session.member.id);
  const games = all.filter((g) => !g.archivedAt);
  const archived = all.filter((g) => g.archivedAt).sort((a, b) => b.archivedAt!.getTime() - a.archivedAt!.getTime());
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });

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
        <CreateGameForm />
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
                      {g.role === "cohost" && " · tu la co-organises"}
                    </p>
                  </div>
                  <Link href={`/killer/${g.code}/panneau`} className="-my-2.5 py-2.5 text-sm font-semibold text-primary hover:underline">
                    Ouvrir le panneau
                  </Link>
                </div>
                {g.role === "host" && (
                  <div>
                    <DeleteGameButton code={g.code} title={g.title} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>Co-organiser une partie</SectionTitle>
        <p className="mt-1 text-sm text-muted">L&apos;organisateur te donne le code de sa partie et son mot de passe de co-organisation.</p>
        <Card className="mt-3 p-5">
          <JoinOrganizationForm />
        </Card>
      </section>

      {archived.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Parties archivées</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {archived.map((g) => (
              <Card key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-display font-bold text-ink">{g.title}</p>
                  <p className="text-xs text-muted">
                    {g.startedAt ? `Jouée le ${day.format(g.startedAt)}` : "Archivée"} · code {g.code}
                  </p>
                </div>
                <Link href={`/killer/${g.code}/archive`} className="-my-2.5 py-2.5 text-sm font-semibold text-primary hover:underline">
                  Consulter
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
