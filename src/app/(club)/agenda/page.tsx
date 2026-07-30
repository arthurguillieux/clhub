import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { computeSharedAvailability, summarizeByDay } from "@/modules/agenda/data/sharedAvailability";
import { listClubEventsInRange } from "@/modules/agenda/data/clubEvents";
import { buildMonthGrid } from "@/core/ui/calendar/layout";
import { addDays, isWeekend, parse, startOfMonth, today, type CalendarDate } from "@/core/date";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { LinkButton } from "@/core/ui/components/Button";
import { DeleteClubEventButton } from "./DeleteClubEventButton";

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

  const [availability, monthEvents] = await Promise.all([
    computeSharedAvailability(gridStart, gridEnd),
    listClubEventsInRange(gridStart, gridEnd),
  ]);
  const summaryByDay = new Map(
    summarizeByDay(availability, weeks.flatMap((w) => w.days)).map((s) => [s.day, s]),
  );
  const eventsByDay = new Map<CalendarDate, typeof monthEvents>();
  for (const event of monthEvents) {
    const day = event.eventDate as CalendarDate;
    const dayEvents = eventsByDay.get(day) ?? [];
    dayEvents.push(event);
    eventsByDay.set(day, dayEvents);
  }
  const currentMonthNumber = monthAnchor.slice(0, 7);
  const nobodyConnected = availability.members.every((m) => m.busyDays === null);

  const isAdmin = await isAdminModeActive();

  return (
    <Container>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>L&apos;agenda en commun</PageTitle>
        <LinkButton href="/agenda/new" variant="accent">
          + Ajouter un évènement
        </LinkButton>
      </div>
      <p className="mt-2 text-sm text-muted">
        Les jours et week-ends où tout le monde est libre, en un coup d&apos;œil — chacun
        connecte son agenda perso dans ses réglages, on n&apos;affiche jamais que les
        créneaux occupés. Les grandes étapes du club (•) sont purement informatives — elles ne
        touchent jamais aux agendas personnels de chacun.
      </p>

      {nobodyConnected && (
        <p className="mt-4 text-sm text-muted">
          Personne n&apos;a encore connecté son agenda perso —{" "}
          <Link href="/settings" className="text-primary underline underline-offset-2">
            connecte le tien
          </Link>{" "}
          pour voir qui est libre quand.
        </p>
      )}
      {!nobodyConnected && availability.uncountedCount > 0 && (
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
            const summary = !nobodyConnected ? summaryByDay.get(day) : undefined;
            const dayEvents = eventsByDay.get(day) ?? [];
            const weekend = isWeekend(day);
            const allFree = !!summary && summary.countedTotal > 0 && summary.freeCount === summary.countedTotal;
            const tooltipParts = [
              summary && summary.busyMemberNames.length > 0 ? `Occupé·es : ${summary.busyMemberNames.join(", ")}` : null,
              dayEvents.length > 0 ? dayEvents.map((e) => e.title).join(", ") : null,
            ].filter(Boolean);
            return (
              <div
                key={day}
                title={tooltipParts.length > 0 ? tooltipParts.join(" — ") : undefined}
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
                {inMonth && dayEvents.length > 0 && (
                  <span aria-hidden="true" className="glow-box-accent mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </div>
            );
          }),
        )}
      </div>

      {monthEvents.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Évènements du mois</SectionTitle>
          <Card className="mt-3 p-5">
            <ul className="flex flex-col gap-3">
              {monthEvents.map((event) => {
                const canDelete = isAdmin || event.createdById === session.member.id;
                return (
                  <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-ink">
                        {event.title}
                        <span className="ml-2 font-normal text-muted">
                          {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                      </p>
                      {event.description && <p className="mt-0.5 text-muted">{event.description}</p>}
                      <p className="mt-0.5 text-xs text-muted">Ajouté par {event.authorName}</p>
                    </div>
                    {canDelete && <DeleteClubEventButton eventId={event.id} title={event.title} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </Container>
  );
}
