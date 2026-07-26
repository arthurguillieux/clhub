import Link from "next/link";
import { computeWrapped } from "@/core/achievements/wrapped";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { today } from "@/core/date";

function euros(cents: number): string {
  return `${(cents / 100).toFixed(0)} €`;
}

export default async function WrappedPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = Number(today().slice(0, 4));
  const year = yearParam ? Number(yearParam) : currentYear;

  const data = await computeWrapped(year);
  const hasAnyData =
    data.mostCovetedItem !== null || data.busiestMonth !== null || data.topDuo !== null;

  return (
    <Container>
      <div className="flex items-center justify-between">
        <PageTitle>CLHUB Wrapped {year}</PageTitle>
        <div className="flex gap-3 text-sm font-medium text-muted">
          <Link href={`/wrapped?year=${year - 1}`} className="hover:text-ink">
            ← {year - 1}
          </Link>
          {year < currentYear && (
            <Link href={`/wrapped?year=${year + 1}`} className="hover:text-ink">
              {year + 1} →
            </Link>
          )}
        </div>
      </div>

      {!hasAnyData ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted">
            {`Pas encore assez d'activité en ${year} pour une rétrospective — reviens plus tard dans l'année !`}
          </p>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {data.mostCovetedItem && (
            <Card className="p-6">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                L&apos;objet le plus convoité
              </p>
              <p className="mt-2 font-display text-2xl font-extrabold text-ink text-balance">
                {data.mostCovetedItem.name}
              </p>
              <p className="mt-1 text-sm text-muted">
                {data.mostCovetedItem.requestCount} demande
                {data.mostCovetedItem.requestCount > 1 ? "s" : ""} cette année
              </p>
            </Card>
          )}

          {data.busiestMonth && (
            <Card className="p-6">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Le mois le plus chargé
              </p>
              <p className="mt-2 font-display text-2xl font-extrabold text-ink capitalize">
                {data.busiestMonth.label}
              </p>
              <p className="mt-1 text-sm text-muted">
                {data.busiestMonth.count} demande{data.busiestMonth.count > 1 ? "s" : ""}
              </p>
            </Card>
          )}

          {data.topDuo && (
            <Card className="p-6">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Le duo prêteur / emprunteur de l&apos;année
              </p>
              <p className="mt-2 font-display text-2xl font-extrabold text-ink text-balance">
                {data.topDuo.ownerName} &amp; {data.topDuo.borrowerName}
              </p>
              <p className="mt-1 text-sm text-muted">
                {data.topDuo.count} prêt{data.topDuo.count > 1 ? "s" : ""} ensemble
              </p>
            </Card>
          )}

          <Card className="p-6">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              Partagé cette année
            </p>
            <p className="mt-2 font-display text-2xl font-extrabold text-ink">
              {data.totalItemDaysShared} jours-objets
            </p>
            {data.totalSavingsCents > 0 && (
              <p className="mt-1 text-sm text-muted">
                {`Grâce au club, environ ${euros(data.totalSavingsCents)} d'achats évités.`}
              </p>
            )}
          </Card>
        </div>
      )}
    </Container>
  );
}
