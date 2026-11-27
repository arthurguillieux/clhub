import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { GroupLabel, PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { listForMember, span } from "@/modules/nouvel-an/data";
import { nextNewYear, nextTitle } from "@/modules/nouvel-an/domain/template";
import { NewEditionForm } from "./NewEditionForm";

export const metadata: Metadata = { title: "Nouvel an" };

/** The New Years I organize or am invited to, and a new one (often from last year's). */
export default async function NouvelAnPage() {
  const me = (await getSession())!.member.id; // the (club) layout lets signed-in members only
  const all = await listForMember(me);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const next = nextNewYear(today);
  const organized = all.filter((e) => e.organizer);
  const last = organized[0];
  const defaults = { title: last ? nextTitle(last.title, next.year) : `Nouvel an ${next.year}`, startsOn: next.startsOn, endsOn: next.endsOn };

  return (
    <Container size="md">
      <Link href="/celebrer" className="-my-2 inline-block py-2 text-sm text-muted hover:text-ink">
        ← Célébrer
      </Link>
      <div className="mt-2">
        <PageTitle section="nouvelan">Nouvel an</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">Les invités, qui fait quoi, les listes qui se calculent selon le nombre, le budget, et qui a payé.</p>

      {all.length > 0 && (
        <section className="mt-6">
          <GroupLabel>Les nouvels ans</GroupLabel>
          <Card className="mt-2">
            <ul className="divide-y divide-line-soft">
              {all.map((e) => (
                <li key={e.code}>
                  <Link href={`/celebrer/nouvel-an/${e.code}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-surface-raised">
                    <span>
                      <span className="block font-semibold text-ink">🥂 {e.title}</span>
                      <span className="block text-sm text-muted">
                        {span(e.startsOn, e.endsOn)}
                        {e.place ? ` · ${e.place}` : ""}
                        {e.organizer ? " · tu organises" : " · tu es invité·e"}
                        {e.endsOn < today ? " · passé" : ""}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-muted">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section className="mt-8">
        <GroupLabel>Préparer un nouvel an</GroupLabel>
        <Card className="mt-2 p-5">
          <NewEditionForm defaults={defaults} previous={organized.map((e) => ({ code: e.code, title: e.title }))} />
        </Card>
      </section>
    </Container>
  );
}
