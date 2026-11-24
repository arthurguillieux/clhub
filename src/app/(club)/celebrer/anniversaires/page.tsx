import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { GroupLabel, PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { LinkButton } from "@/core/ui/components/Button";
import { listForMember, longDate } from "@/modules/anniversaire/data";

export const metadata: Metadata = { title: "Anniversaires" };

const ANSWER = { pending: "à toi de dire si tu participes", yes: "tu participes", no: "tu ne participes pas" } as const;

/** The birthdays I'm in on, to come then past. Never the ones about me: they don't exist for me. */
export default async function BirthdaysPage() {
  const me = (await getSession())!.member.id;
  const all = await listForMember(me);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const coming = all.filter((b) => b.date >= today);
  const past = all.filter((b) => b.date < today).reverse();

  const row = (b: (typeof all)[number]) => (
    <li key={b.id}>
      <Link href={`/celebrer/anniversaires/${b.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-surface-raised">
        <span>
          <span className="block font-semibold text-ink">🎂 {b.name}</span>
          <span className="block text-sm text-muted">
            {longDate(b.date)} · {b.bought ? "cadeau acheté" : ANSWER[b.answer]}
            {b.mine ? " · tu organises" : ""}
          </span>
        </span>
        <span aria-hidden="true" className="text-muted">
          →
        </span>
      </Link>
    </li>
  );

  return (
    <Container size="md">
      <Link href="/celebrer" className="-my-2 inline-block py-2 text-sm text-muted hover:text-ink">
        ← Célébrer
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <PageTitle section="anniversaire">Anniversaires</PageTitle>
        <LinkButton href="/celebrer/anniversaires/nouveau" variant="accent">
          Préparer un anniversaire
        </LinkButton>
      </div>
      <p className="mt-2 text-sm text-muted">Le cadeau d&apos;un ami, préparé à plusieurs dans son dos. Seuls ceux qu&apos;on met dans la confidence voient l&apos;anniversaire.</p>

      {all.length === 0 ? (
        <Card className="mt-6 p-5">
          <p className="text-sm text-muted">Aucun anniversaire en préparation avec toi pour l&apos;instant.</p>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {coming.length > 0 && (
            <section>
              <GroupLabel>À venir</GroupLabel>
              <Card className="mt-2">
                <ul className="divide-y divide-line-soft">{coming.map(row)}</ul>
              </Card>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <GroupLabel>Passés</GroupLabel>
              <Card className="mt-2">
                <ul className="divide-y divide-line-soft">{past.map(row)}</ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </Container>
  );
}
