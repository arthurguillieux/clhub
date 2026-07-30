import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getRecipeDetail, getMyReview } from "@/modules/recipes/data/recipes";
import { parseDietaryTags, dietaryTagLabel } from "@/core/dietaryTags";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { Badge } from "@/core/ui/components/Badge";
import { StarRating } from "@/core/ui/components/StarRating";
import { ReviewForm } from "./ReviewForm";
import { DeleteRecipeButton } from "./DeleteRecipeButton";
import { DeleteReviewButton } from "./DeleteReviewButton";

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

  const isOwner = session.member.id === r.createdById;
  const isAdmin = await isAdminModeActive();
  const canManage = isOwner || isAdmin;

  const meta = [
    r.servings ? `${r.servings} personne${r.servings > 1 ? "s" : ""}` : null,
    r.prepMinutes ? `Prépa ${r.prepMinutes} min` : null,
    r.cookMinutes ? `Cuisson ${r.cookMinutes} min` : null,
  ].filter(Boolean);
  const dietaryTags = parseDietaryTags(r.dietaryTags);

  return (
    <Container>
      <Link href="/recettes" className="text-sm font-medium text-muted hover:text-ink">
        ← Nos recettes
      </Link>

      <div className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <PageTitle>{r.title}</PageTitle>
          {canManage && (
            <div className="flex shrink-0 items-center gap-3 pt-1">
              <Link
                href={`/recettes/${r.id}/edit`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Modifier
              </Link>
              {isAdmin && <DeleteRecipeButton recipeId={r.id} title={r.title} />}
            </div>
          )}
        </div>
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
        {dietaryTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dietaryTags.map((tag) => (
              <Badge key={tag}>{dietaryTagLabel(tag)}</Badge>
            ))}
          </div>
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
                  <div className="flex items-center gap-3">
                    <StarRating value={rev.rating} />
                    {isAdmin && (
                      <DeleteReviewButton recipeId={r.id} memberId={rev.memberId} />
                    )}
                  </div>
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
