import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Card } from "@/core/ui/components/Card";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { listForMember, listOthers } from "@/modules/lettre/data/letters";
import { STAGE_LABELS, giftCount } from "@/modules/lettre/domain/letter";
import { CreateLetterForm, JoinLetterForm } from "./LetterForms";

export const metadata: Metadata = { title: "Ma lettre au Père Noël" };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function LetterHomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const [mine, others] = await Promise.all([listForMember(session.member.id), listOthers(session.member.id)]);
  const now = new Date();
  // Between Boxing Day and New Year's Eve, the next letter is for next Christmas.
  const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
  const link = "-my-2.5 py-2.5 text-sm font-semibold text-primary hover:underline";

  return (
    <Container size="sm">
      <Link href="/jeux" className="text-sm font-medium text-muted hover:text-ink">
        ← Jeux
      </Link>
      <div className="mt-2">
        <PageTitle section="jeux">Ma lettre au Père Noël</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        La liste de Noël d&apos;un enfant, pour toute la famille. En haut, sa photo et les quelques lignes qu&apos;il a écrites ; en dessous, ses cadeaux. Tu envoies un seul
        lien : chacun réserve ce qu&apos;il offre, ou participe à une cagnotte pour un gros cadeau, et la liste se met à jour pour tout le monde.
      </p>

      <Card className="mt-6 p-5">
        <CreateLetterForm year={year} />
      </Card>

      {mine.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Tes lettres</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {mine.map((l) => (
              <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-display font-bold text-ink">{l.title}</p>
                  <p className="text-xs text-muted">
                    {capitalize(giftCount(l.gifts))}
                    {l.taken > 0 && ` · ${l.taken} déjà pris`} · {STAGE_LABELS[l.stage]}
                    {l.role === "cohost" && " · tu la co-organises"}
                  </p>
                </div>
                <Link href={`/lettre/${l.code}/panneau`} className={link}>
                  Organiser
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>Co-organiser une lettre</SectionTitle>
        <p className="mt-1 text-sm text-muted">La personne qui l&apos;a créée te donne son code et le mot de passe de co-organisation.</p>
        <Card className="mt-3 p-5">
          <JoinLetterForm />
        </Card>
      </section>

      {others.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Ailleurs au CLHUB</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {others.map((l) => (
              <Card key={l.id} className="p-4">
                <p className="font-display font-bold text-ink">{l.title}</p>
                <p className="text-xs text-muted">
                  Organisée par {l.organizer} · {giftCount(l.gifts)} · {STAGE_LABELS[l.stage]}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
