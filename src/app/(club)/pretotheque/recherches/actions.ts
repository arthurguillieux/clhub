"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import {
  closeWantedPost,
  createWantedPost,
  expressInterest,
  withdrawInterest,
} from "@/modules/pretotheque/data/wantedPosts";

const postSchema = z.object({
  title: z.string().trim().min(1, "Décris ce que tu cherches.").max(150),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
  neededBy: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type CreateWantedPostState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function createWantedPostAction(
  _prevState: CreateWantedPostState,
  formData: FormData,
): Promise<CreateWantedPostState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    neededBy: formData.get("neededBy"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await createWantedPost(session.member.id, parsed.data);
  revalidatePath("/pretotheque/recherches");
  return { status: "success" };
}

export async function expressInterestAction(wantedPostId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await expressInterest(wantedPostId, session.member.id);
  revalidatePath("/pretotheque/recherches");
}

export async function withdrawInterestAction(wantedPostId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await withdrawInterest(wantedPostId, session.member.id);
  revalidatePath("/pretotheque/recherches");
}

export async function closeWantedPostAction(wantedPostId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await closeWantedPost(wantedPostId, session.member.id);
  revalidatePath("/pretotheque/recherches");
}
