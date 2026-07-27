"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { logActivity } from "@/core/activity";
import { createRecipe } from "@/modules/recipes/data/recipes";

const createSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom à cette recette.").max(150),
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
