import Link from "next/link";
import { listMenuEvents } from "@/modules/menus/data/menuEvents";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { LinkButton } from "@/core/ui/components/Button";
import { formatFrench, type CalendarDate } from "@/core/date";

export default async function MenusPage() {
  const events = await listMenuEvents();

  return (
    <Container>
      <div className="flex items-center justify-between gap-3">
        <PageTitle>Les menus du club</PageTitle>
        <LinkButton href="/menus/new" variant="accent">
          Proposer un repas
        </LinkButton>
      </div>
      <p className="mt-2 text-sm text-muted">
        Qui vient, qui apporte quoi — un sondage tout simple pour organiser un repas de
        groupe.
      </p>

      {events.length === 0 ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted">
            Aucun repas proposé pour l&apos;instant — sois le premier.
          </p>
        </Card>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/menus/${e.id}`}>
                <Card className="p-5 hover:bg-surface">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-extrabold text-ink">{e.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatFrench(e.eventDate as CalendarDate)} — proposé par {e.creatorName}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium text-muted">
                      {e.attendingCount} {e.attendingCount > 1 ? "présents" : "présent"}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
