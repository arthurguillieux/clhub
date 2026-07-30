import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getClubEventById } from "@/modules/agenda/data/clubEvents";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { EditClubEventForm } from "../EditClubEventForm";

export default async function EditClubEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const event = await getClubEventById(id);
  if (!event) notFound();

  const isOwner = session.member.id === event.createdById;
  const isAdmin = await isAdminModeActive();
  if (!isOwner && !isAdmin) {
    redirect("/agenda");
  }

  return (
    <Container size="sm">
      <Link href="/agenda" className="text-sm font-medium text-muted hover:text-ink">
        ← L&apos;agenda en commun
      </Link>
      <div className="mt-2">
        <PageTitle>Modifier {event.title}</PageTitle>
      </div>
      <Card className="mt-6 p-6">
        <EditClubEventForm eventId={event.id} event={event} />
      </Card>
    </Container>
  );
}
