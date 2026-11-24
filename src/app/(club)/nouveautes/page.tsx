import Link from "next/link";
import { listChangelogDays, type ChangelogDay } from "@/modules/changelog/data/entries";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { formatFrench, type CalendarDate } from "@/core/date";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouveautés" };

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « novembre 2026 » from « 2026-11-24 ». */
function monthOf(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

/** The days, month by month, newest first (the list already comes newest first). */
function byMonth(days: ChangelogDay[]): { month: string; days: ChangelogDay[]; count: number }[] {
  const out: { month: string; days: ChangelogDay[]; count: number }[] = [];
  for (const day of days) {
    const month = monthOf(day.date);
    const last = out[out.length - 1];
    if (last && last.month === month) {
      last.days.push(day);
      last.count += day.entries.length;
    } else out.push({ month, days: [day], count: day.entries.length });
  }
  return out;
}

export default async function ChangelogPage() {
  const months = byMonth(await listChangelogDays());

  return (
    <Container size="sm">
      <Link href="/" className="-my-2 inline-block py-2 text-sm font-medium text-muted hover:text-ink">
        ← Accueil
      </Link>
      <div className="mt-2">
        <PageTitle>Nouveautés</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">Les ajouts et correctifs du CLHUB, mois par mois. Le mois en cours est déplié.</p>

      {months.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Rien pour l&apos;instant.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {months.map((m, i) => (
            <details key={m.month} open={i === 0} className="group rounded-card border border-line bg-surface">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                <span className="font-display text-lg font-bold text-ink first-letter:uppercase">{m.month}</span>
                <span className="flex items-center gap-3 text-sm text-muted">
                  {m.count} {m.count > 1 ? "nouveautés" : "nouveauté"}
                  <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-line-soft p-3 sm:p-4">
                {m.days.map((day) => (
                  <Card key={day.date} className="bg-ground/40 p-4">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">{formatFrench(day.date as CalendarDate)}</p>
                    <ul className="mt-2 flex flex-col gap-2 text-sm text-ink">
                      {day.entries.map((entry) => (
                        <li key={entry} className="flex gap-2">
                          <span aria-hidden="true" className="text-primary">
                            •
                          </span>
                          <span>{entry}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </Container>
  );
}
