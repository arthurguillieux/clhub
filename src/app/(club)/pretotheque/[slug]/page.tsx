import { notFound, redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { getItemWithOwnerBySlug } from "@/modules/pretotheque/data/items";

const CATEGORY_LABELS: Record<string, string> = {
  bricolage: "Bricolage",
  jardinage: "Jardinage",
  menage: "Ménage",
  festif: "Festif",
  autre: "Autre",
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

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const { slug } = await params;
  const item = await getItemWithOwnerBySlug(slug);
  if (!item) {
    notFound();
  }

  return (
    <main style={{ maxWidth: "500px", margin: "48px auto", fontFamily: "sans-serif" }}>
      {item.photoPath && (
        // eslint-disable-next-line @next/next/no-img-element -- unstyled placeholder page
        <img
          src={item.photoPath}
          alt=""
          style={{ width: "100%", maxHeight: "300px", objectFit: "cover", borderRadius: "6px" }}
        />
      )}
      <h1 style={{ fontSize: "22px", marginTop: "16px" }}>{item.name}</h1>
      <p style={{ color: "#666", fontSize: "14px" }}>
        {CATEGORY_LABELS[item.category] ?? item.category} — proposé par {item.ownerName}
      </p>

      {item.description && <p>{item.description}</p>}

      <dl style={{ fontSize: "14px" }}>
        {(item.brand || item.model) && (
          <>
            <dt style={{ fontWeight: 600 }}>Marque / modèle</dt>
            <dd>{[item.brand, item.model].filter(Boolean).join(" — ")}</dd>
          </>
        )}
        {item.productUrl && (
          <>
            <dt style={{ fontWeight: 600 }}>Lien produit</dt>
            <dd>
              <a href={item.productUrl} target="_blank" rel="noreferrer">
                {item.productUrl}
              </a>
            </dd>
          </>
        )}
        {euros(item.priceCents) && (
          <>
            <dt style={{ fontWeight: 600 }}>Prix</dt>
            <dd>{euros(item.priceCents)}</dd>
          </>
        )}
        {euros(item.replacementValueCents) && (
          <>
            <dt style={{ fontWeight: 600 }}>Valeur de remplacement</dt>
            <dd>{euros(item.replacementValueCents)}</dd>
          </>
        )}
        <dt style={{ fontWeight: 600 }}>État</dt>
        <dd>{CONDITION_LABELS[item.condition] ?? item.condition}</dd>
        {item.accessories && (
          <>
            <dt style={{ fontWeight: 600 }}>Accessoires fournis</dt>
            <dd>{item.accessories}</dd>
          </>
        )}
        {item.consumables && (
          <>
            <dt style={{ fontWeight: 600 }}>Consommables à prévoir</dt>
            <dd>{item.consumables}</dd>
          </>
        )}
        {item.safetyNotes && (
          <>
            <dt style={{ fontWeight: 600 }}>Consignes de sécurité</dt>
            <dd>{item.safetyNotes}</dd>
          </>
        )}
        {item.pickupLocation && (
          <>
            <dt style={{ fontWeight: 600 }}>Récupération</dt>
            <dd>
              {item.pickupLocation}
              {item.pickupNotes && ` — ${item.pickupNotes}`}
            </dd>
          </>
        )}
        {item.maxLoanDays && (
          <>
            <dt style={{ fontWeight: 600 }}>Durée de prêt max</dt>
            <dd>{item.maxLoanDays} jours</dd>
          </>
        )}
        <dt style={{ fontWeight: 600 }}>Validation</dt>
        <dd>{item.autoApprove ? "Automatique" : "Manuelle par le propriétaire"}</dd>
      </dl>

      <p style={{ color: "#999", fontSize: "13px" }}>
        Le calendrier de réservation arrive au lot 2c.
      </p>
    </main>
  );
}
