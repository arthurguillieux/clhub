"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { createProjectWithBookings } from "@/modules/pretotheque/data/projects";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

const schema = z.object({
  name: z.string().trim().min(1, "Donne un nom à ton chantier.").max(150),
  startDate: isoDate,
  endDate: isoDate,
  message: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  itemIds: z.array(z.string().uuid()).min(1, "Choisis au moins un objet."),
});

export type CreateProjectState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function createProjectAction(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    message: formData.get("message"),
    itemIds: formData.getAll("itemIds"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  if (parsed.data.startDate > parsed.data.endDate) {
    return { status: "error", message: "La date de fin doit être après la date de début." };
  }

  const { project } = await createProjectWithBookings(session.member.id, parsed.data);
  redirect(`/pretotheque/mine?chantier=${project.id}`);
}
