import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { computeSharedAvailability, summarizeByDay } from "@/modules/agenda/data/sharedAvailability";
import { buildMonthGrid } from "@/core/ui/calendar/layout";
import { addDays, isWeekend, parse, startOfMonth, today, type CalendarDate } from "@/core/date";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function monthLabel(anchor: CalendarDate): string {
  const [year, month] = anchor.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { month } = await searchParams;
  const monthAnchor = startOfMonth(month ? parse(month) : today());
  const prevMonth = addDays(monthAnchor, -1);
  const nextMonth = addDays(monthAnchor, 32);

  const weeks = buildMonthGrid(monthAnchor);
  const gridStart = weeks[0]?.days[0] as CalendarDate;
  const gridEnd = weeks[5]?.days[6] as CalendarDate;

  const availability = await computeSharedAvailability(gridStart, gridEnd);
  const summaryByDay = new Map(
    summarizeByDay(availability, weeks.flatMap((w) => w.days)).map((s) => [s.day, s]),
  );
  const currentMonthNumber = monthAnchor.slice(0, 7);
  const nobodyConnected = availability.members.every((m) => m.busyDays === null);

  return (
    <Container>
      <PageTitle>L&apos;agenda en commun</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Les jours et week-ends où tout le monde est libre, en un coup d&apos;œil — chacun
        connecte son agenda perso dans ses réglages, on n&apos;affiche jamais que les
        créneaux occupés.
      </p>

      {nobodyConnected ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted">
            Personne n&apos;a encore connecté son agenda —{" "}
            <Link href="/settings" className="text-primary underline underline-offset-2">
              connecte le tien
            </Link>{" "}
            pour commencer.
          </p>
        </Card>
      ) : (
        <>
          {availability.uncountedCount > 0 && (
            <p className="mt-4 text-xs text-muted">
              {`${availability.uncountedCount} membre${availability.uncountedCount > 1 ? "s n'ont" : " n'a"} pas d'agenda connecté — non compté${availability.uncountedCount > 1 ? "s" : ""} ci-dessous.`}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <Link href={`/agenda?month=${prevMonth}`} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface">
              ← Mois précédent
            </Link>
            <span className="font-display text-base font-extrabold text-ink capitalize">
              {monthLabel(monthAnchor)}
            </span>
            <Link href={`/agenda?month=${nextMonth}`} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface">
              Mois suivant →
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] tracking-wide text-muted uppercase">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {weeks.flatMap((week) =>
              week.days.map((day) => {
                const inMonth = day.slice(0, 7) === currentMonthNumber;
                const summary = summaryByDay.get(day);
                const weekend = isWeekend(day);
                const allFree = !!summary && summary.countedTotal > 0 && summary.freeCount === summary.countedTotal;
                return (
                  <div
                    key={day}
                    title={summary && summary.busyMemberNames.length > 0 ? `Occupé·es : ${summary.busyMemberNames.join(", ")}` : undefined}
                    className={[
                      "flex h-16 flex-col items-center justify-center rounded-md border p-1 text-center",
                      !inMonth ? "border-transparent opacity-30" : allFree ? "border-primary bg-primary/10" : weekend ? "border-line-soft bg-surface" : "border-line-soft",
                    ].join(" ")}
                  >
                    <span className={`text-xs ${inMonth ? "text-ink" : "text-muted"}`}>
                      {Number(day.slice(8, 10))}
                    </span>
                    {inMonth && summary && summary.countedTotal > 0 && (
                      <span className={`mt-1 text-[11px] font-semibold ${allFree ? "text-primary" : "text-muted"}`}>
                        {allFree ? "Tous libres" : `${summary.freeCount}/${summary.countedTotal} libres`}
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </>
      )}
    </Container>
  );
}
