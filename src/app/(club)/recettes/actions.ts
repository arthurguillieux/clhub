"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { logActivity } from "@/core/activity";
import {
  createRecipe,
  deleteRecipe,
  deleteReview,
  getRecipeById,
  updateRecipe,
  upsertReview,
} from "@/modules/recipes/data/recipes";

const optionalMinutes = z.coerce
  .number()
  .int()
  .positive()
  .max(1440)
  .optional()
  .transform((v) => v ?? null);

const createSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom à cette recette.").max(150),
  equipment: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  prepMinutes: optionalMinutes,
  cookMinutes: optionalMinutes,
  ingredients: z.string().trim().min(1, "Liste au moins un ingrédient.").max(3000),
  instructions: z.string().trim().min(1, "Décris au moins une étape.").max(5000),
});

export type CreateRecipeState = { status: "idle" } | { status: "error"; message: string };

export async function createRecipeAction(
  _prevState: CreateRecipeState,
  formData: FormData,
): Promise<CreateRecipeState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    equipment: formData.get("equipment"),
    prepMinutes: formData.get("prepMinutes") || undefined,
    cookMinutes: formData.get("cookMinutes") || undefined,
    ingredients: formData.get("ingredients"),
    instructions: formData.get("instructions"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const created = await createRecipe(session.member.id, parsed.data);

  await logActivity({
    section: "recettes",
    kind: "recipe.added",
    actorId: session.member.id,
    subjectRef: `recipe:${created.id}`,
    payload: { title: created.title },
  });

  redirect(`/recettes/${created.id}`);
}

export type UpdateRecipeState = { status: "idle" } | { status: "error"; message: string };

/** Owner or admin — same split as pretotheque's updateItemAction. */
export async function updateRecipeAction(
  recipeId: string,
  _prevState: UpdateRecipeState,
  formData: FormData,
): Promise<UpdateRecipeState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const targetRecipe = await getRecipeById(recipeId);
  if (!targetRecipe) return { status: "error", message: "Cette recette n'existe plus." };

  const isAdmin = await isAdminModeActive();
  if (targetRecipe.createdById !== session.member.id && !isAdmin) {
    return { status: "error", message: "Tu n'as pas le droit de modifier cette recette." };
  }

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    equipment: formData.get("equipment"),
    prepMinutes: formData.get("prepMinutes") || undefined,
    cookMinutes: formData.get("cookMinutes") || undefined,
    ingredients: formData.get("ingredients"),
    instructions: formData.get("instructions"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await updateRecipe(recipeId, parsed.data);
  revalidatePath(`/recettes/${recipeId}`);
  revalidatePath("/recettes");
  redirect(`/recettes/${recipeId}`);
}

/** Admin-mode only — deleting your own recipe isn't a self-service action, same split as item deletion. */
export async function deleteRecipeAction(recipeId: string): Promise<void> {
  const isAdmin = await isAdminModeActive();
  if (!isAdmin) return;

  await deleteRecipe(recipeId);
  revalidatePath("/recettes");
  redirect("/recettes");
}

/** Admin-mode only — moderation, not a self-delete for the review's own author. */
export async function deleteReviewAction(recipeId: string, memberId: string): Promise<void> {
  const isAdmin = await isAdminModeActive();
  if (!isAdmin) return;

  await deleteReview(recipeId, memberId);
  revalidatePath(`/recettes/${recipeId}`);
  revalidatePath("/recettes");
}

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choisis une note.").max(5),
  comment: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type SubmitReviewState = { status: "idle" } | { status: "success" } | { status: "error"; message: string };

export async function submitReviewAction(
  recipeId: string,
  _prevState: SubmitReviewState,
  formData: FormData,
): Promise<SubmitReviewState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = reviewSchema.safeParse({
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await upsertReview(recipeId, session.member.id, parsed.data);

  revalidatePath(`/recettes/${recipeId}`);
  revalidatePath("/recettes");
  return { status: "success" };
}
