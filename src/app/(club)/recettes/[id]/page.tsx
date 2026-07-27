import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { getRecipeDetail, getMyReview } from "@/modules/recipes/data/recipes";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { StarRating } from "@/core/ui/components/StarRating";
import { ReviewForm } from "./ReviewForm";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const [r, myReview] = await Promise.all([getRecipeDetail(id), getMyReview(id, session.member.id)]);
  if (!r) notFound();

  const meta = [
    r.prepMinutes ? `Prépa ${r.prepMinutes} min` : null,
    r.cookMinutes ? `Cuisson ${r.cookMinutes} min` : null,
  ].filter(Boolean);

  return (
    <Container>
      <Link href="/recettes" className="text-sm font-medium text-muted hover:text-ink">
        ← Nos recettes
      </Link>

      <div className="mt-4">
        <PageTitle>{r.title}</PageTitle>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>
            Par {r.authorName} ·{" "}
            {r.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          {r.reviewCount > 0 && (
            <span className="flex items-center gap-1.5">
              <StarRating value={r.averageRating ?? 0} />
              <span>
                {r.averageRating!.toFixed(1)} ({r.reviewCount} avis)
              </span>
            </span>
          )}
        </div>
        {(meta.length > 0 || r.equipment) && (
          <p className="mt-2 text-sm text-muted">
            {meta.join(" · ")}
            {meta.length > 0 && r.equipment ? " · " : ""}
            {r.equipment ? `Matériel : ${r.equipment}` : ""}
          </p>
        )}
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

      <section className="mt-8">
        <SectionTitle>Ton avis</SectionTitle>
        <Card className="mt-3 p-4">
          <ReviewForm recipeId={id} myReview={myReview} />
        </Card>
      </section>

      {r.reviews.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Avis ({r.reviews.length})</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {r.reviews.map((rev) => (
              <Card key={rev.memberId} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{rev.memberName}</p>
                  <StarRating value={rev.rating} />
                </div>
                {rev.comment && <p className="mt-1.5 text-sm text-muted">{rev.comment}</p>}
              </Card>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
