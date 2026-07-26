import { notFound } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { getItemWithOwnerBySlug } from "@/modules/pretotheque/data/items";
import { Container } from "@/core/ui/components/Container";
import { Card } from "@/core/ui/components/Card";
import { Badge } from "@/core/ui/components/Badge";
import { CATEGORY_BG, categoryLabel } from "@/core/ui/categories";

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

  return (
    <Container>
      <Card className="overflow-hidden">
        <div className={`relative h-56 ${CATEGORY_BG[item.category] ?? "bg-cat-autre"}`}>
          {item.photoPath && (
            // eslint-disable-next-line @next/next/no-img-element -- item hero photo
            <img src={item.photoPath} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="p-6">
          <Badge>{categoryLabel(item.category)}</Badge>
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
          </dl>

          <p className="mt-6 text-xs text-muted">
            Le calendrier de réservation arrive au lot 2c.
          </p>
        </div>
      </Card>
    </Container>
  );
}
