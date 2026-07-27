import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listRecipes, type RecipeSort } from "@/modules/recipes/data/recipes";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { LinkButton } from "@/core/ui/components/Button";
import { StarRating } from "@/core/ui/components/StarRating";

const SORTS: { value: RecipeSort; label: string }[] = [
  { value: "date", label: "Plus récentes" },
  { value: "rating", label: "Mieux notées" },
  { value: "reviews", label: "Plus commentées" },
];

export default async function RecettesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { sort: sortParam } = await searchParams;
  const sort: RecipeSort = sortParam === "rating" || sortParam === "reviews" ? sortParam : "date";

  const recipes = await listRecipes(sort);

  return (
    <Container size="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Nos recettes</PageTitle>
        <LinkButton href="/recettes/new" variant="accent">
          + Proposer une recette
        </LinkButton>
      </div>

      <div className="mt-4 flex gap-4 text-sm font-medium">
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={s.value === "date" ? "/recettes" : `/recettes?sort=${s.value}`}
            className={sort === s.value ? "text-primary" : "text-muted hover:text-ink"}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {recipes.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Le carnet est encore vide.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <Link key={r.id} href={`/recettes/${r.id}`}>
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <h3 className="font-display text-base font-extrabold text-ink">{r.title}</h3>
                <p className="mt-1 text-xs text-muted">Par {r.authorName}</p>
                {r.reviewCount > 0 ? (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                    <StarRating value={r.averageRating ?? 0} />
                    <span>({r.reviewCount})</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">Pas encore d&apos;avis</p>
                )}
                <p className="mt-3 line-clamp-3 text-sm text-muted">{r.ingredients}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
