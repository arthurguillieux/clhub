import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getEventDetail } from "@/modules/caisse/data/events";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { EditEventForm } from "../EditEventForm";

export default async function EditExpenseEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) notFound();

  const isOwner = session.member.id === detail.event.createdById;
  const isAdmin = await isAdminModeActive();
  if (!isOwner && !isAdmin) {
    redirect(`/caisse/${id}`);
  }

  return (
    <Container size="sm">
      <Link href={`/caisse/${id}`} className="text-sm font-medium text-muted hover:text-ink">
        ← {detail.event.name}
      </Link>
      <div className="mt-2">
        <PageTitle>Modifier {detail.event.name}</PageTitle>
      </div>
      <Card className="mt-6 p-6">
        <EditEventForm eventId={id} name={detail.event.name} />
      </Card>
    </Container>
  );
}
