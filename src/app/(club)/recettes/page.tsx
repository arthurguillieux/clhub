import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listRecipes } from "@/modules/recipes/data/recipes";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { LinkButton } from "@/core/ui/components/Button";

export default async function RecettesPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const recipes = await listRecipes();

  return (
    <Container size="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Nos recettes</PageTitle>
        <LinkButton href="/recettes/new" variant="accent">
          + Proposer une recette
        </LinkButton>
      </div>

      {recipes.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Le carnet est encore vide.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <Link key={r.id} href={`/recettes/${r.id}`}>
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <h3 className="font-display text-base font-extrabold text-ink">{r.title}</h3>
                <p className="mt-1 text-xs text-muted">Par {r.authorName}</p>
                <p className="mt-3 line-clamp-3 text-sm text-muted">{r.ingredients}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
