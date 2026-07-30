import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listListings } from "@/modules/dons/data/listings";
import { listDonCategories } from "@/modules/dons/data/categories";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { Badge } from "@/core/ui/components/Badge";
import { LinkButton } from "@/core/ui/components/Button";

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Réservé",
};

export default async function DonsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { category: categoryParam } = await searchParams;
  const categories = await listDonCategories();
  const category = categories.find((c) => c.id === categoryParam);

  const listings = await listListings(category?.id);

  return (
    <Container size="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle>Cabanes à dons</PageTitle>
          <p className="mt-1 text-sm text-muted">Dons, troc et petites ventes entre membres.</p>
        </div>
        <LinkButton href="/dons/new" variant="accent">
          + Proposer un objet
        </LinkButton>
      </div>

      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
          <Link href="/dons" className={!category ? "text-primary" : "text-muted hover:text-ink"}>
            Tout
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/dons?category=${c.id}`}
              className={category?.id === c.id ? "text-primary" : "text-muted hover:text-ink"}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {listings.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          {category ? `Rien en "${category.name}" pour l'instant.` : "Rien à proposer pour l'instant."}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link key={l.id} href={`/dons/${l.id}`}>
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative h-36 bg-surface-raised">
                  {l.photoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- catalog thumbnail
                    <img src={l.photoPath} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl opacity-40">🎁</div>
                  )}
                  {l.status !== "available" && (
                    <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white">
                      {STATUS_LABELS[l.status] ?? l.status}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <Badge>{l.categoryName}</Badge>
                  </div>
                  <h3 className="mt-2 font-display text-base font-extrabold text-ink">{l.title}</h3>
                  <p className="mt-1 text-xs text-muted">Proposé par {l.authorName}</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {l.isFree ? "Gratuit" : l.priceText || "Prix à discuter"}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
