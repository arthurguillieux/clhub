import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getMenuEventDetail } from "@/modules/menus/data/menuEvents";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { EditMenuEventForm } from "../EditMenuEventForm";

export default async function EditMenuEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const event = await getMenuEventDetail(id);
  if (!event) notFound();

  const isOwner = session.member.id === event.createdById;
  const isAdmin = await isAdminModeActive();
  if (!isOwner && !isAdmin) {
    redirect(`/menus/${id}`);
  }

  return (
    <Container size="sm">
      <Link href={`/menus/${id}`} className="text-sm font-medium text-muted hover:text-ink">
        ← {event.title}
      </Link>
      <div className="mt-2">
        <PageTitle>Modifier {event.title}</PageTitle>
      </div>
      <Card className="mt-6 p-6">
        <EditMenuEventForm eventId={event.id} event={event} />
      </Card>
    </Container>
  );
}
