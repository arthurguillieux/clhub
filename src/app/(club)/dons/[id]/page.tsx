import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getListingDetail } from "@/modules/dons/data/listings";
import { Container } from "@/core/ui/components/Container";
import { Card } from "@/core/ui/components/Card";
import { Badge } from "@/core/ui/components/Badge";
import { DeleteListingButton } from "./DeleteListingButton";
import { InterestButton } from "./InterestButton";
import { OwnerControls } from "./OwnerControls";

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Réservé",
  completed: "Donné / vendu",
};

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const listing = await getListingDetail(id);
  if (!listing) notFound();

  const isOwner = session.member.id === listing.createdById;
  const isAdmin = await isAdminModeActive();
  const canManage = isOwner || isAdmin;
  const isInterested = listing.interests.some((i) => i.memberId === session.member.id);

  return (
    <Container>
      <Link href="/dons" className="text-sm font-medium text-muted hover:text-ink">
        ← Cabanes à dons
      </Link>

      <Card className="mt-4 overflow-hidden">
        <div className="relative h-64 bg-surface-raised">
          {listing.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- listing cover photo
            <img src={listing.photoPath} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl opacity-40">🎁</div>
          )}
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge>{listing.categoryName}</Badge>
              {listing.status !== "available" && (
                <span className="inline-flex items-center rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white">
                  {STATUS_LABELS[listing.status] ?? listing.status}
                </span>
              )}
            </div>
            {canManage && listing.status !== "completed" && (
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/dons/${listing.id}/edit`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Modifier
                </Link>
                {isAdmin && <DeleteListingButton listingId={listing.id} title={listing.title} />}
              </div>
            )}
          </div>

          <h1 className="mt-3 font-display text-2xl font-extrabold text-ink text-balance">
            {listing.title}
          </h1>
          <p className="mt-1 text-sm text-muted">Proposé par {listing.authorName}</p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {listing.isFree ? "Gratuit" : listing.priceText || "Prix à discuter"}
          </p>

          {listing.description && (
            <p className="mt-4 text-sm whitespace-pre-wrap text-ink">{listing.description}</p>
          )}
        </div>
      </Card>

      {listing.status === "completed" ? (
        <p className="mt-6 text-sm text-muted">
          Cette annonce est terminée{listing.reservedForName ? ` — allé·e à ${listing.reservedForName}` : ""}.
        </p>
      ) : canManage ? (
        <div className="mt-6">
          <OwnerControls
            listingId={listing.id}
            status={listing.status}
            interests={listing.interests}
            reservedForName={listing.reservedForName}
          />
        </div>
      ) : listing.status === "available" ? (
        <div className="mt-6">
          <InterestButton listingId={listing.id} isInterested={isInterested} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Cet objet est réservé.</p>
      )}
    </Container>
  );
}
