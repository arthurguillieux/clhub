import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getItemBySlug } from "@/modules/pretotheque/data/items";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { EditItemForm } from "../EditItemForm";

export default async function EditItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) notFound();

  const isOwner = session.member.id === item.ownerId;
  const isAdmin = await isAdminModeActive();
  if (!isOwner && !isAdmin) {
    redirect(`/pretotheque/${slug}`);
  }

  return (
    <Container size="sm">
      <Link href={`/pretotheque/${slug}`} className="text-sm font-medium text-muted hover:text-ink">
        ← {item.name}
      </Link>
      <div className="mt-2">
        <PageTitle>Modifier {item.name}</PageTitle>
      </div>
      <Card className="mt-6 p-6">
        <EditItemForm itemId={item.id} itemSlug={item.slug} item={item} />
      </Card>
    </Container>
  );
}
