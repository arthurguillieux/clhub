import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { listForMember } from "@/modules/santa/data/events";
import { CreateSantaForm, JoinSantaForm } from "./SantaForms";

export const metadata: Metadata = { title: "Secret Santa" };

export default async function SantaHomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { organized, participating } = await listForMember(session.member.id);
  const current = organized.filter((e) => !e.archivedAt);
  const archived = organized.filter((e) => e.archivedAt);
  const link = "-my-2.5 py-2.5 text-sm font-semibold text-primary hover:underline";

  return (
    <Container size="sm">
      <Link href="/jeux" className="text-sm font-medium text-muted hover:text-ink">
        ← Jeux
      </Link>
      <div className="mt-2">
        <PageTitle>Secret Santa</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        Tu listes les participants, membres du club ou pas, tu ajoutes tes règles (« ces deux-là ne se tirent pas »), et le CLHUB fait le tirage et envoie à
        chacun son lien perso. Personne ne voit le résultat, pas même toi.
      </p>

      {participating.length > 0 && (
        <section className="mt-6">
          <SectionTitle>Tu participes à</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {participating.map((p) => (
              <Card key={p.token} className="flex items-center justify-between gap-3 p-4">
                <p className="font-display font-bold text-ink">{p.title}</p>
                <Link href={`/santa/moi/${p.token}`} className={link}>
                  Voir ma page
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Card className="mt-6 p-5">
        <CreateSantaForm />
      </Card>

      {current.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Tes Secret Santa</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {current.map((e) => (
              <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-display font-bold text-ink">{e.title}</p>
                  <p className="text-xs text-muted">
                    {e.status === "launched" ? "tirage effectué" : "en préparation"}
                    {e.role === "cohost" && " · tu le co-organises"}
                  </p>
                </div>
                <Link href={`/santa/${e.code}/panneau`} className={link}>
                  Organiser
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>Co-organiser un Secret Santa</SectionTitle>
        <p className="mt-1 text-sm text-muted">Son organisateur te donne le code et le mot de passe de co-organisation.</p>
        <Card className="mt-3 p-5">
          <JoinSantaForm />
        </Card>
      </section>

      {archived.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Archives</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {archived.map((e) => (
              <Card key={e.id} className="flex items-center justify-between gap-3 p-4">
                <p className="font-display font-bold text-ink">{e.title}</p>
                <Link href={`/santa/${e.code}/archive`} className={link}>
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
