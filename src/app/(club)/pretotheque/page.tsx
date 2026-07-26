import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { listItems } from "@/modules/pretotheque/data/items";

const CATEGORY_LABELS: Record<string, string> = {
  bricolage: "Bricolage",
  jardinage: "Jardinage",
  menage: "Ménage",
  festif: "Festif",
  autre: "Autre",
};

export default async function PretothequePage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const items = await listItems();

  return (
    <main style={{ maxWidth: "600px", margin: "48px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "20px" }}>Prêtothèque</h1>
      <p>
        <Link href="/pretotheque/new">+ Ajouter un objet</Link>
      </p>

      {items.length === 0 && <p style={{ color: "#999" }}>Rien dans le catalogue pour l&apos;instant.</p>}

      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {items.map((it) => (
          <li key={it.id} style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "12px" }}>
            <Link href={`/pretotheque/${it.slug}`} style={{ display: "flex", gap: "12px" }}>
              {it.photoPath && (
                // eslint-disable-next-line @next/next/no-img-element -- unstyled placeholder page
                <img src={it.photoPath} alt="" width={64} height={64} style={{ objectFit: "cover", borderRadius: "4px" }} />
              )}
              <div>
                <strong>{it.name}</strong>
                <div style={{ fontSize: "13px", color: "#666" }}>
                  {CATEGORY_LABELS[it.category] ?? it.category} — proposé par {it.ownerName}
                  {it.priceCents !== null && ` — ${(it.priceCents / 100).toFixed(2)} €`}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
