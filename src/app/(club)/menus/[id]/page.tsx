import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getMenuEventDetail, getMyResponse } from "@/modules/menus/data/menuEvents";
import { parseDietaryTags, dietaryTagLabel } from "@/core/dietaryTags";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { formatFrench, type CalendarDate } from "@/core/date";
import { ResponseForm } from "./ResponseForm";
import { DeleteMenuEventButton } from "./DeleteMenuEventButton";

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

  const isOwner = session.member.id === event.createdById;
  const isAdmin = await isAdminModeActive();
  const canManage = isOwner || isAdmin;

  const attending = event.responses.filter((r) => r.attending);
  const notAttending = event.responses.filter((r) => !r.attending);

  const dietSummary = new Map<string, string[]>();
  const noteEntries: { name: string; note: string }[] = [];
  for (const r of attending) {
    for (const tag of parseDietaryTags(r.dietaryTags)) {
      const names = dietSummary.get(tag) ?? [];
      names.push(r.memberName);
      dietSummary.set(tag, names);
    }
    if (r.dietaryNotes) {
      noteEntries.push({ name: r.memberName, note: r.dietaryNotes });
    }
  }
  const hasDietSummary = dietSummary.size > 0 || noteEntries.length > 0;

  return (
    <Container>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageTitle>{event.title}</PageTitle>
        {canManage && (
          <div className="flex shrink-0 items-center gap-3 pt-1">
            <Link href={`/menus/${event.id}/edit`} className="text-xs font-semibold text-primary hover:underline">
              Modifier
            </Link>
            {isAdmin && <DeleteMenuEventButton eventId={event.id} title={event.title} />}
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        {formatFrench(event.eventDate as CalendarDate)} — proposé par {event.creatorName}
      </p>
      {event.description && <p className="mt-4 text-sm text-ink whitespace-pre-wrap">{event.description}</p>}

      {hasDietSummary && (
        <div className="mt-6 rounded-md border border-amber-400/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            ⚠️ Besoins alimentaires parmi les participants
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
            {[...dietSummary.entries()].map(([tag, names]) => (
              <li key={tag}>
                <span className="font-semibold">{dietaryTagLabel(tag)}</span> — {names.join(", ")}
              </li>
            ))}
            {noteEntries.map(({ name, note }) => (
              <li key={name}>
                <span className="font-semibold">{name}</span> — {note}
              </li>
            ))}
          </ul>
        </div>
      )}

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
