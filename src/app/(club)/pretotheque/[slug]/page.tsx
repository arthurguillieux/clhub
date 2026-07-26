import { notFound } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { getItemWithOwnerBySlug } from "@/modules/pretotheque/data/items";
import { listBookingsWithBorrowerForItem } from "@/modules/pretotheque/data/bookings";
import { listCommentsForItem } from "@/modules/pretotheque/data/comments";
import { listMaintenanceLogForItem } from "@/modules/pretotheque/data/maintenance";
import { listItemPhotos } from "@/modules/pretotheque/data/itemPhotos";
import { itemQrSvg } from "@/core/qrcode";
import Link from "next/link";
import { Container } from "@/core/ui/components/Container";
import { Card } from "@/core/ui/components/Card";
import { Badge } from "@/core/ui/components/Badge";
import { SectionTitle } from "@/core/ui/components/Heading";
import { CATEGORY_BG, categoryLabel, itemStatusLabel } from "@/core/ui/categories";
import { BookingWidget } from "./BookingWidget";
import { CommentForm } from "./CommentForm";
import { MaintenanceForm } from "./MaintenanceForm";
import { PhotoGallery } from "./PhotoGallery";

const MAINTENANCE_KIND_LABELS: Record<string, string> = {
  issue: "Signalement",
  maintenance: "Entretien",
};

const CONDITION_LABELS: Record<string, string> = {
  neuf: "Neuf",
  bon: "Bon état",
  usage: "Usagé",
  fragile: "Fragile",
};

function euros(cents: number | null): string | null {
  return cents === null ? null : `${(cents / 100).toFixed(2)} €`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { slug } = await params;
  const item = await getItemWithOwnerBySlug(slug);
  if (!item) {
    notFound();
  }

  const [bookings, comments, maintenanceLog, photos] = await Promise.all([
    listBookingsWithBorrowerForItem(item.id),
    listCommentsForItem(item.id),
    listMaintenanceLogForItem(item.id),
    listItemPhotos(item.id),
  ]);

  const isOwner = session.member.id === item.ownerId;
  const isAvailable = item.status === "available";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const qrSvg = await itemQrSvg(`${appUrl}/pretotheque/${item.slug}`);

  return (
    <Container>
      <Card className="overflow-hidden">
        <PhotoGallery
          itemId={item.id}
          itemSlug={item.slug}
          categoryBg={CATEGORY_BG[item.category] ?? "bg-cat-autre"}
          photos={photos.map((p) => ({ id: p.id, path: p.path, isPrimary: p.isPrimary }))}
          isOwner={isOwner}
        />
        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            <Badge>{categoryLabel(item.category)}</Badge>
            {!isAvailable && (
              <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white dark:bg-red-500">
                {itemStatusLabel(item.status)}
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-ink text-balance">
            {item.name}
          </h1>
          <p className="mt-1 text-sm text-muted">Proposé par {item.ownerName}</p>

          {item.description && <p className="mt-4 text-sm text-ink">{item.description}</p>}

          <dl className="mt-6 divide-y divide-line-soft border-t border-line-soft">
            {(item.brand || item.model) && (
              <DetailRow
                label="Marque / modèle"
                value={[item.brand, item.model].filter(Boolean).join(" — ")}
              />
            )}
            {item.productUrl && (
              <DetailRow
                label="Lien produit"
                value={
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Voir le produit
                  </a>
                }
              />
            )}
            {euros(item.priceCents) && (
              <DetailRow
                label="Prix"
                value={<span className="font-mono tabular-nums">{euros(item.priceCents)}</span>}
              />
            )}
            {euros(item.replacementValueCents) && (
              <DetailRow
                label="Valeur de remplacement"
                value={
                  <span className="font-mono tabular-nums">
                    {euros(item.replacementValueCents)}
                  </span>
                }
              />
            )}
            <DetailRow label="État" value={CONDITION_LABELS[item.condition] ?? item.condition} />
            {item.accessories && <DetailRow label="Accessoires fournis" value={item.accessories} />}
            {item.consumables && (
              <DetailRow label="Consommables à prévoir" value={item.consumables} />
            )}
            {item.safetyNotes && (
              <DetailRow label="Consignes de sécurité" value={item.safetyNotes} />
            )}
            {item.pickupLocation && (
              <DetailRow
                label="Récupération"
                value={
                  item.pickupNotes
                    ? `${item.pickupLocation} — ${item.pickupNotes}`
                    : item.pickupLocation
                }
              />
            )}
            {item.maxLoanDays && (
              <DetailRow label="Durée de prêt max" value={`${item.maxLoanDays} jours`} />
            )}
            <DetailRow
              label="Validation"
              value={item.autoApprove ? "Automatique" : "Manuelle par le propriétaire"}
            />
            <DetailRow
              label="Étiquette"
              value={
                <div className="flex items-center gap-3">
                  <div
                    className="h-20 w-20 shrink-0 [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <Link
                    href="/pretotheque/etiquettes"
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    Imprimer toutes les étiquettes
                  </Link>
                </div>
              }
            />
          </dl>

        </div>
      </Card>

      <div className="mt-8">
        <SectionTitle>Disponibilité</SectionTitle>
        <Card className="mt-3 p-5">
          {isAvailable ? (
            <BookingWidget
              itemId={item.id}
              itemSlug={item.slug}
              category={item.category}
              bookings={bookings
                .filter((b) => b.status === "pending" || b.status === "approved" || b.status === "active")
                .map((b) => ({
                  id: b.id,
                  startDate: b.startDate,
                  endDate: b.endDate,
                  status: b.status,
                  borrowerName: b.borrowerName,
                }))}
            />
          ) : (
            <p className="text-sm text-muted">
              Cet objet n&apos;est pas disponible au prêt pour le moment
              ({itemStatusLabel(item.status).toLowerCase()}).
            </p>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle>Signalements et entretien</SectionTitle>
        <Card className="mt-3 p-5">
          {maintenanceLog.length === 0 ? (
            <p className="text-sm text-muted">Aucun historique pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {maintenanceLog.map((entry) => (
                <li key={entry.id} className="border-b border-line-soft pb-4 last:border-0 last:pb-0">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {MAINTENANCE_KIND_LABELS[entry.kind] ?? entry.kind}
                  </p>
                  <p className="mt-1 text-sm text-ink whitespace-pre-wrap">{entry.note}</p>
                  <p className="mt-1 text-xs text-muted">
                    {entry.authorName} — {entry.createdAt.toLocaleDateString("fr-FR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <MaintenanceForm
            itemId={item.id}
            itemSlug={item.slug}
            isOwner={isOwner}
            isBroken={!isAvailable}
          />
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle>Commentaires et astuces</SectionTitle>
        <Card className="mt-3 p-5">
          {comments.length === 0 ? (
            <p className="text-sm text-muted">Rien pour l&apos;instant — sois le premier à écrire.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {comments.map((c) => (
                <li key={c.id} className="border-b border-line-soft pb-4 last:border-0 last:pb-0">
                  <p className="text-sm text-ink whitespace-pre-wrap">{c.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {c.authorName} — {c.createdAt.toLocaleDateString("fr-FR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <CommentForm itemId={item.id} itemSlug={item.slug} />
        </Card>
      </div>
    </Container>
  );
}
