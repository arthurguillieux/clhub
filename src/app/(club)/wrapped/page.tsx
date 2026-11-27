import Link from "next/link";
import type { Metadata } from "next";
import { computeWrapped } from "@/core/achievements/wrapped";
import { clubYear, statLabel, type PoleLife } from "@/core/achievements/club";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { SectionTile } from "@/core/ui/components/SectionIcon";
import { POLES } from "@/core/ui/sections";
import { euros } from "@/core/money";
import { today } from "@/core/date";

export const metadata: Metadata = { title: "CLHUB Wrapped" };

/**
 * The year of the club, pole by pole — what was shared, cooked, gathered, played and celebrated — and
 * not only the Prêtothèque. No ranking: the club as a whole, never one member against another.
 */
export default async function WrappedPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: yearParam } = await searchParams;
  const currentYear = Number(today().slice(0, 4));
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : currentYear;

  const [club, loans] = await Promise.all([clubYear(year), computeWrapped(year)]);
  const byPole = new Map(club.poles.map((p) => [p.pole, p]));
  const extras: Partial<Record<PoleLife["pole"], string[]>> = {
    partager: [
      loans.mostCovetedItem ? `L'objet le plus demandé : ${loans.mostCovetedItem.name} (${loans.mostCovetedItem.requestCount} demande${loans.mostCovetedItem.requestCount > 1 ? "s" : ""}).` : null,
      loans.totalItemDaysShared ? `${loans.totalItemDaysShared} jours-objets partagés${loans.totalSavingsCents > 0 ? `, environ ${euros(loans.totalSavingsCents)} d'achats évités` : ""}.` : null,
      loans.topDuo ? `Le duo de l'année : ${loans.topDuo.ownerName} prête, ${loans.topDuo.borrowerName} emprunte (${loans.topDuo.count} fois).` : null,
    ].filter((x): x is string => !!x),
    retrouver: club.spentCents > 0 ? [`${euros(club.spentCents)} de dépenses partagées dans les caisses communes.`] : [],
  };
  const empty = club.poles.length === 0 && !extras.partager?.length;

  return (
    <Container>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>CLHUB Wrapped {year}</PageTitle>
        <div className="flex gap-3 text-sm font-medium text-muted">
          <Link href={`/wrapped?year=${year - 1}`} className="py-2 hover:text-ink">
            ← {year - 1}
          </Link>
          {year < currentYear && (
            <Link href={`/wrapped?year=${year + 1}`} className="py-2 hover:text-ink">
              {year + 1} →
            </Link>
          )}
        </div>
      </div>

      {empty ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted">{`Pas encore assez d'activité en ${year} pour une rétrospective. Reviens plus tard dans l'année !`}</p>
        </Card>
      ) : (
        <>
          <p className="mt-3 max-w-prose text-sm text-muted">
            {year} au CLHUB, dans toute sa diversité
            {club.newMembers > 0 ? ` : ${club.newMembers} nouveau${club.newMembers > 1 ? "x" : ""} membre${club.newMembers > 1 ? "s" : ""}` : ""}
            {club.busiestMonth ? `${club.newMembers > 0 ? ", et" : " :"} le mois le plus vivant, c'était ${club.busiestMonth.label}` : ""}.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {POLES.map((pole) => {
              const life = byPole.get(pole.id);
              const more = extras[pole.id] ?? [];
              if (!life && !more.length) return null;
              return (
                <Card key={pole.id} className="flex flex-col gap-4 p-6">
                  <div className="flex items-center gap-3">
                    <SectionTile id={pole.id} size={40} />
                    <p className="font-display text-xl font-extrabold text-ink">{pole.name}</p>
                  </div>
                  {life && (
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {life.stats.map((x) => (
                        <li key={x.one}>
                          <span className="block font-display text-3xl font-extrabold text-ink tabular-nums">{x.n}</span>
                          <span className="block text-sm text-muted">{statLabel(x)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {more.map((line) => (
                    <p key={line} className="text-sm text-ink">
                      {line}
                    </p>
                  ))}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </Container>
  );
}
