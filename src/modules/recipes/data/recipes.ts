import { and, desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { member, recipe, recipeReview, user, type Recipe } from "@/core/db/schema";

export interface CreateRecipeInput {
  title: string;
  equipment: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string;
  instructions: string;
}

export async function createRecipe(createdById: string, input: CreateRecipeInput): Promise<Recipe> {
  const [created] = await db
    .insert(recipe)
    .values({ createdById, ...input })
    .returning();
  if (!created) throw new Error("Failed to create recipe");
  return created;
}

export interface RecipeSummary extends Recipe {
  authorName: string;
  averageRating: number | null;
  reviewCount: number;
}

export type RecipeSort = "date" | "rating" | "reviews";

export async function listRecipes(sort: RecipeSort = "date"): Promise<RecipeSummary[]> {
  const rows = await db
    .select({ recipe, authorName: user.name })
    .from(recipe)
    .innerJoin(member, eq(member.id, recipe.createdById))
    .innerJoin(user, eq(user.id, member.userId))
    .orderBy(desc(recipe.createdAt));
  if (rows.length === 0) return [];

  const reviews = await db.select({ recipeId: recipeReview.recipeId, rating: recipeReview.rating }).from(recipeReview);
  const statsByRecipe = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const current = statsByRecipe.get(r.recipeId) ?? { sum: 0, count: 0 };
    current.sum += r.rating;
    current.count += 1;
    statsByRecipe.set(r.recipeId, current);
  }

  const summaries: RecipeSummary[] = rows.map((r) => {
    const stats = statsByRecipe.get(r.recipe.id);
    return {
      ...r.recipe,
      authorName: r.authorName,
      averageRating: stats ? stats.sum / stats.count : null,
      reviewCount: stats?.count ?? 0,
    };
  });

  if (sort === "rating") {
    return summaries.sort((a, b) => (b.averageRating ?? -1) - (a.averageRating ?? -1));
  }
  if (sort === "reviews") {
    return summaries.sort((a, b) => b.reviewCount - a.reviewCount);
  }
  return summaries; // already date-desc from the query
}

export interface ReviewWithMember {
  memberId: string;
  memberName: string;
  rating: number;
  comment: string | null;
  updatedAt: Date;
}

export interface RecipeDetail extends RecipeSummary {
  reviews: ReviewWithMember[];
}

export async function getRecipeDetail(id: string): Promise<RecipeDetail | null> {
  const row = await db
    .select({ recipe, authorName: user.name })
    .from(recipe)
    .innerJoin(member, eq(member.id, recipe.createdById))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(recipe.id, id))
    .limit(1);

  const first = row[0];
  if (!first) return null;

  const reviewRows = await db
    .select({
      memberId: recipeReview.memberId,
      rating: recipeReview.rating,
      comment: recipeReview.comment,
      updatedAt: recipeReview.updatedAt,
      memberName: user.name,
    })
    .from(recipeReview)
    .innerJoin(member, eq(member.id, recipeReview.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(recipeReview.recipeId, id))
    .orderBy(desc(recipeReview.updatedAt));

  const averageRating =
    reviewRows.length > 0 ? reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length : null;

  return {
    ...first.recipe,
    authorName: first.authorName,
    averageRating,
    reviewCount: reviewRows.length,
    reviews: reviewRows,
  };
}

export async function getMyReview(
  recipeId: string,
  memberId: string,
): Promise<{ rating: number; comment: string | null } | null> {
  const [row] = await db
    .select({ rating: recipeReview.rating, comment: recipeReview.comment })
    .from(recipeReview)
    .where(and(eq(recipeReview.recipeId, recipeId), eq(recipeReview.memberId, memberId)));
  return row ?? null;
}

export async function upsertReview(
  recipeId: string,
  memberId: string,
  input: { rating: number; comment: string | null },
): Promise<void> {
  await db
    .insert(recipeReview)
    .values({ recipeId, memberId, ...input })
    .onConflictDoUpdate({
      target: [recipeReview.recipeId, recipeReview.memberId],
      set: { ...input, updatedAt: new Date() },
    });
}
