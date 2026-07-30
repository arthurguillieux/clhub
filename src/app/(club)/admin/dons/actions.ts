"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/admin";
import { createDonCategory } from "@/modules/dons/data/categories";

const nameSchema = z.string().trim().min(1, "Donne un nom à la catégorie.").max(60);

export type CreateCategoryState = { status: "idle" } | { status: "error"; message: string };

export async function createDonCategoryAction(
  _prevState: CreateCategoryState,
  formData: FormData,
): Promise<CreateCategoryState> {
  await requireAdmin();

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Nom invalide." };
  }

  try {
    await createDonCategory(parsed.data);
  } catch {
    return { status: "error", message: "Cette catégorie existe déjà." };
  }

  revalidatePath("/admin/dons");
  revalidatePath("/dons");
  revalidatePath("/dons/new");
  return { status: "idle" };
}
