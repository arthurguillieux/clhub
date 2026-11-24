import { notFound } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getItemWithOwnerBySlug } from "@/modules/pretotheque/data/items";
import { listBookingsWithBorrowerForItem } from "@/modules/pretotheque/data/bookings";
import { listCommentsForItem } from "@/modules/pretotheque/data/comments";
import { listMaintenanceLogForItem } from "@/modules/pretotheque/data/maintenance";
import { listItemPhotos } from "@/modules/pretotheque/data/itemPhotos";
import { listAllUnitsForItem } from "@/modules/pretotheque/data/itemUnits";
import { itemQrSvg } from "@/core/qrcode";
import Link from "next/link";
import { Container } from "@/core/ui/components/Container";
import { Card } from "@/core/ui/components/Card";
import { Badge } from "@/core/ui/components/Badge";
import { LinkButton } from "@/core/ui/components/Button";
import { GroupLabel, SectionTitle } from "@/core/ui/components/Heading";
import { categoryLabel, itemStatusLabel } from "@/core/ui/categories";
import { BookingWidget } from "./BookingWidget";
import { CommentForm } from "./CommentForm";
import { DeleteCommentButton } from "./DeleteCommentButton";
import { MaintenanceForm } from "./MaintenanceForm";
import { PhotoGallery, PhotoManager } from "./PhotoGallery";
import { UnitsManager } from "./UnitsManager";
import { DeleteItemButton } from "@/app/(club)/admin/objets/DeleteItemButton";
import { euros } from "@/core/money";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getItemWithOwnerBySlug(slug);
  return { title: d?.name || "Prêtothèque" };
}

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

  const [bookings, comments, maintenanceLog, photos, units] = await Promise.all([
    listBookingsWithBorrowerForItem(item.id),
    listCommentsForItem(item.id),
    listMaintenanceLogForItem(item.id),
    listItemPhotos(item.id),
    listAllUnitsForItem(item.id),
  ]);

  const isOwner = session.member.id === item.ownerId;
  const isAdmin = await isAdminModeActive();
  const canManage = isOwner || isAdmin;
  const isAvailable = item.status === "available";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const qrSvg = await itemQrSvg(`${appUrl}/pretotheque/${item.slug}`);

  const activeUnits = units.filter((u) => !u.archivedAt);
  const showUnitLabels = activeUnits.length > 1;
  const unitLabelById = new Map(activeUnits.map((u, i) => [u.id, u.label ?? `Exemplaire ${i + 1}`]));

  const facts = [
    CONDITION_LABELS[item.condition] ?? item.condition,
    item.maxLoanDays ? `${item.maxLoanDays} jours max` : null,
    item.autoApprove ? "Réservation directe" : "Le propriétaire valide",
  ].filter(Boolean) as string[];
  const hasMore =
    item.brand || item.model || item.productUrl || item.priceCents !== null || item.replacementValueCents !== null || item.accessories || item.consumables;
  const photoList = photos.map((p) => ({ id: p.id, path: p.path, isPrimary: p.isPrimary }));

  return (
    <Container>
      <Link href="/pretotheque" className="-my-2 inline-block py-2 text-sm text-muted hover:text-ink">
        ← Prêtothèque
      </Link>

      {/* 1. What it is, at a glance. */}
      <Card className="mt-3 overflow-hidden">
        <PhotoGallery photos={photoList} />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{categoryLabel(item.category)}</Badge>
            {!isAvailable && (
              <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white dark:bg-red-500">
                {itemStatusLabel(item.status)}
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-balance text-ink">{item.name}</h1>
          <p className="mt-1 text-sm text-muted">Proposé par {item.ownerName}</p>
          {item.description && <p className="mt-4 text-sm whitespace-pre-wrap text-ink">{item.description}</p>}

          <ul className="mt-4 flex flex-wrap gap-2 text-xs">
            {facts.map((f) => (
              <li key={f} className="rounded-full border border-line-soft px-3 py-1 text-muted">
                {f}
              </li>
            ))}
          </ul>
          {item.pickupLocation && (
            <p className="mt-3 text-sm text-ink">
              <span className="text-muted">À récupérer : </span>
              {item.pickupNotes ? `${item.pickupLocation} — ${item.pickupNotes}` : item.pickupLocation}
            </p>
          )}
          {item.safetyNotes && (
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-ink">
              <strong className="font-semibold">Sécurité : </strong>
              {item.safetyNotes}
            </p>
          )}
        </div>
      </Card>

      {/* 2. Can I borrow it? Straight after, not at the bottom of the page. */}
      <section id="reserver" className="mt-6 scroll-mt-20">
        <SectionTitle>Disponibilité</SectionTitle>
        <Card className="mt-3 p-5">
          {isAvailable ? (
            <BookingWidget
              itemId={item.id}
              itemSlug={item.slug}
              category={item.category}
              currentMemberId={session.member.id}
              bookings={bookings
                .filter((b) => b.status === "pending" || b.status === "approved" || b.status === "active")
                .map((b) => ({
                  id: b.id,
                  startDate: b.startDate,
                  endDate: b.endDate,
                  status: b.status,
                  borrowerName: b.borrowerName,
                  borrowerId: b.borrowerId,
                  unitLabel: showUnitLabels ? unitLabelById.get(b.unitId) : undefined,
                }))}
            />
          ) : (
            <p className="text-sm text-muted">
              Cet objet n&apos;est pas disponible au prêt pour le moment ({itemStatusLabel(item.status).toLowerCase()}).
            </p>
          )}
        </Card>
      </section>

      {/* 3. The owner's tools, folded away: borrowers don't need them. */}
      {canManage && (
        <details className="group mt-6 rounded-card border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-display font-bold text-ink [&::-webkit-details-marker]:hidden">
            {isOwner ? "Gérer mon objet" : "Gérer cet objet"}
            <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="flex flex-col gap-6 border-t border-line-soft p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <LinkButton href={`/pretotheque/${item.slug}/edit`} variant="ghost">
                Modifier la fiche
              </LinkButton>
              {isAdmin && <DeleteItemButton itemId={item.id} name={item.name} redirectTo="/pretotheque" />}
            </div>
            <div>
              <GroupLabel>Photos</GroupLabel>
              <div className="mt-2">
                <PhotoManager itemId={item.id} itemSlug={item.slug} photos={photoList} />
              </div>
            </div>
            <div>
              <GroupLabel>Exemplaires</GroupLabel>
              <div className="mt-2">
                <UnitsManager
                  itemId={item.id}
                  itemSlug={item.slug}
                  units={units.map((u) => ({ id: u.id, label: u.label, archivedAt: u.archivedAt }))}
                />
              </div>
            </div>
            <div>
              <GroupLabel>Étiquette</GroupLabel>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-20 w-20 shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <Link href="/pretotheque/etiquettes" className="py-2 text-sm text-primary underline underline-offset-2">
                  Imprimer les étiquettes
                </Link>
              </div>
            </div>
          </div>
        </details>
      )}

      {/* 4. The rest of the sheet, for whoever wants the detail. */}
      {hasMore && (
        <section className="mt-8">
          <SectionTitle>Bon à savoir</SectionTitle>
          <Card className="mt-3 p-5">
            <dl className="divide-y divide-line-soft">
              {(item.brand || item.model) && <DetailRow label="Marque / modèle" value={[item.brand, item.model].filter(Boolean).join(" — ")} />}
              {item.productUrl && (
                <DetailRow
                  label="Lien produit"
                  value={
                    <a href={item.productUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                      Voir le produit
                    </a>
                  }
                />
              )}
              {item.priceCents !== null && <DetailRow label="Prix" value={<span className="font-mono tabular-nums">{euros(item.priceCents)}</span>} />}
              {item.replacementValueCents !== null && (
                <DetailRow label="Valeur de remplacement" value={<span className="font-mono tabular-nums">{euros(item.replacementValueCents)}</span>} />
              )}
              {item.accessories && <DetailRow label="Accessoires fournis" value={item.accessories} />}
              {item.consumables && <DetailRow label="Consommables à prévoir" value={item.consumables} />}
            </dl>
          </Card>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>Signalements et entretien</SectionTitle>
        <Card className="mt-3 p-5">
          {maintenanceLog.length === 0 ? (
            <p className="text-sm text-muted">Aucun historique pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {maintenanceLog.map((entry) => (
                <li key={entry.id} className="border-b border-line-soft pb-4 last:border-0 last:pb-0">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">{MAINTENANCE_KIND_LABELS[entry.kind] ?? entry.kind}</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{entry.note}</p>
                  <p className="mt-1 text-xs text-muted">
                    {entry.authorName} — {entry.createdAt.toLocaleDateString("fr-FR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <MaintenanceForm itemId={item.id} itemSlug={item.slug} canManage={canManage} isBroken={!isAvailable} />
        </Card>
      </section>

      <section className="mt-8">
        <SectionTitle>Commentaires et astuces</SectionTitle>
        <Card className="mt-3 p-5">
          {comments.length === 0 ? (
            <p className="text-sm text-muted">Rien pour l&apos;instant — sois le premier à écrire.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {comments.map((c) => (
                <li key={c.id} className="border-b border-line-soft pb-4 last:border-0 last:pb-0">
                  <p className="text-sm whitespace-pre-wrap text-ink">{c.body}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3">
                    <p className="text-xs text-muted">
                      {c.authorName} — {c.createdAt.toLocaleDateString("fr-FR")}
                    </p>
                    {isAdmin && <DeleteCommentButton itemId={item.id} itemSlug={item.slug} commentId={c.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <CommentForm itemId={item.id} itemSlug={item.slug} />
        </Card>
      </section>
    </Container>
  );
}
