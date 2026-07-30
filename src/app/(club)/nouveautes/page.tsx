import Link from "next/link";
import { listChangelogDays } from "@/modules/changelog/data/entries";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { formatFrench, type CalendarDate } from "@/core/date";

export default async function ChangelogPage() {
  const days = await listChangelogDays();

  return (
    <Container size="sm">
      <Link href="/" className="text-sm font-medium text-muted hover:text-ink">
        ← Accueil
      </Link>
      <div className="mt-2">
        <PageTitle>Nouveautés</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        Les ajouts et correctifs du Clhub, jour par jour.
      </p>

      {days.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Rien pour l&apos;instant.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {days.map((day) => (
            <Card key={day.date} className="p-5">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                {formatFrench(day.date as CalendarDate)}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink">
                {day.entries.map((entry) => (
                  <li key={entry} className="flex gap-2">
                    <span className="text-primary">•</span>
                    {entry}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}
