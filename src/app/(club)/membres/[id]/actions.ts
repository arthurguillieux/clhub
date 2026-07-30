"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { adminUpdateMemberProfile } from "@/modules/members/data/members";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Le nom ne peut pas être vide.").max(120),
  bio: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v : null)),
  householdSize: z.coerce.number().int().min(1).max(10),
});

export type AdminUpdateMemberProfileState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

/** Admin-mode only — a member always edits their own profile from /settings instead. */
export async function adminUpdateMemberProfileAction(
  memberId: string,
  _prevState: AdminUpdateMemberProfileState,
  formData: FormData,
): Promise<AdminUpdateMemberProfileState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const isAdmin = await isAdminModeActive();
  if (!isAdmin) return { status: "error", message: "Accès refusé." };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio"),
    phone: formData.get("phone"),
    householdSize: formData.get("householdSize"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await adminUpdateMemberProfile(memberId, parsed.data);
  revalidatePath(`/membres/${memberId}`);
  revalidatePath("/membres");
  return { status: "success" };
}
