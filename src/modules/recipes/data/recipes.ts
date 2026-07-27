import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { member, recipe, user, type Recipe } from "@/core/db/schema";

export interface CreateRecipeInput {
  title: string;
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
}

/** Most recently added first. */
export async function listRecipes(): Promise<RecipeSummary[]> {
  const rows = await db
    .select({ recipe, authorName: user.name })
    .from(recipe)
    .innerJoin(member, eq(member.id, recipe.createdById))
    .innerJoin(user, eq(user.id, member.userId))
    .orderBy(desc(recipe.createdAt));

  return rows.map((r) => ({ ...r.recipe, authorName: r.authorName }));
}

export async function getRecipeDetail(id: string): Promise<RecipeSummary | null> {
  const row = await db
    .select({ recipe, authorName: user.name })
    .from(recipe)
    .innerJoin(member, eq(member.id, recipe.createdById))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(recipe.id, id))
    .limit(1);

  const first = row[0];
  return first ? { ...first.recipe, authorName: first.authorName } : null;
}
