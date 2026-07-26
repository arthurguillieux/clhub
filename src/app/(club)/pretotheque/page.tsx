import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listItems } from "@/modules/pretotheque/data/items";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { LinkButton } from "@/core/ui/components/Button";
import { CATEGORY_BG, categoryLabel } from "@/core/ui/categories";

export default async function PretothequePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const items = await listItems();

  return (
    <Container size="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Prêtothèque</PageTitle>
        <LinkButton href="/pretotheque/new" variant="accent">
          + Ajouter un objet
        </LinkButton>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Rien dans le catalogue pour l&apos;instant.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <Link key={it.id} href={`/pretotheque/${it.slug}`}>
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                <div className={`relative h-28 ${CATEGORY_BG[it.category] ?? "bg-cat-autre"}`}>
                  {it.photoPath && (
                    // eslint-disable-next-line @next/next/no-img-element -- catalog thumbnail
                    <img src={it.photoPath} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white">
                    {categoryLabel(it.category)}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-display text-base font-extrabold text-ink">{it.name}</h3>
                  <p className="mt-1 text-xs text-muted">Proposé par {it.ownerName}</p>
                  {it.priceCents !== null && (
                    <p className="mt-2 font-mono text-sm tabular-nums text-ink">
                      {(it.priceCents / 100).toFixed(2)} €
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
