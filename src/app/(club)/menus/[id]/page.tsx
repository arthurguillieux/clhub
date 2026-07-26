import { notFound } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { getMenuEventDetail, getMyResponse } from "@/modules/menus/data/menuEvents";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { formatFrench, type CalendarDate } from "@/core/date";
import { ResponseForm } from "./ResponseForm";

export default async function MenuEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const [event, myResponse] = await Promise.all([
    getMenuEventDetail(id),
    getMyResponse(id, session.member.id),
  ]);
  if (!event) {
    notFound();
  }

  const attending = event.responses.filter((r) => r.attending);
  const notAttending = event.responses.filter((r) => !r.attending);

  return (
    <Container>
      <PageTitle>{event.title}</PageTitle>
      <p className="mt-1 text-sm text-muted">
        {formatFrench(event.eventDate as CalendarDate)} — proposé par {event.creatorName}
      </p>
      {event.description && <p className="mt-4 text-sm text-ink whitespace-pre-wrap">{event.description}</p>}

      <div className="mt-8">
        <SectionTitle>Ta réponse</SectionTitle>
        <Card className="mt-3 p-5">
          <ResponseForm
            eventId={event.id}
            myResponse={
              myResponse
                ? { attending: myResponse.attending, bringing: myResponse.bringing, allergies: myResponse.allergies }
                : null
            }
          />
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle>{`Qui vient (${attending.length})`}</SectionTitle>
        <Card className="mt-3 p-5">
          {attending.length === 0 ? (
            <p className="text-sm text-muted">Personne pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {attending.map((r) => (
                <li key={r.memberId} className="text-sm text-ink">
                  <span className="font-semibold">{r.memberName}</span>
                  {r.bringing && <span className="text-muted"> — apporte : {r.bringing}</span>}
                  {r.allergies && <span className="text-muted"> — {r.allergies}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {notAttending.length > 0 && (
        <div className="mt-8">
          <SectionTitle>{`Ne viennent pas (${notAttending.length})`}</SectionTitle>
          <Card className="mt-3 p-5">
            <ul className="flex flex-col gap-1.5">
              {notAttending.map((r) => (
                <li key={r.memberId} className="text-sm text-muted">
                  {r.memberName}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </Container>
  );
}
