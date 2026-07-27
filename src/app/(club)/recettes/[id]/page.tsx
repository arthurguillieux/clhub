import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { getRecipeDetail } from "@/modules/recipes/data/recipes";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const r = await getRecipeDetail(id);
  if (!r) notFound();

  return (
    <Container>
      <Link href="/recettes" className="text-sm font-medium text-muted hover:text-ink">
        ← Nos recettes
      </Link>

      <div className="mt-4">
        <PageTitle>{r.title}</PageTitle>
        <p className="mt-1 text-sm text-muted">
          Par {r.authorName} ·{" "}
          {r.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Card className="p-5 sm:col-span-1">
          <h2 className="font-display text-sm font-extrabold tracking-wide text-ink uppercase">
            Ingrédients
          </h2>
          <p className="mt-3 text-sm whitespace-pre-line text-ink">{r.ingredients}</p>
        </Card>
        <Card className="p-5 sm:col-span-2">
          <h2 className="font-display text-sm font-extrabold tracking-wide text-ink uppercase">
            Préparation
          </h2>
          <p className="mt-3 text-sm whitespace-pre-line text-ink">{r.instructions}</p>
        </Card>
      </div>
    </Container>
  );
}
