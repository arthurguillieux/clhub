import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getListingById } from "@/modules/dons/data/listings";
import { listDonCategories } from "@/modules/dons/data/categories";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { EditListingForm } from "../EditListingForm";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const isOwner = session.member.id === listing.createdById;
  const isAdmin = await isAdminModeActive();
  if (!isOwner && !isAdmin) {
    redirect(`/dons/${id}`);
  }

  const categories = await listDonCategories();

  return (
    <Container size="sm">
      <Link href={`/dons/${id}`} className="text-sm font-medium text-muted hover:text-ink">
        ← {listing.title}
      </Link>
      <div className="mt-2">
        <PageTitle>Modifier {listing.title}</PageTitle>
      </div>
      <Card className="mt-6 p-6">
        <EditListingForm listingId={listing.id} listing={listing} categories={categories} />
      </Card>
    </Container>
  );
}
