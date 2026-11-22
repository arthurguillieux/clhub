"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { reportBug } from "@/modules/bugs/data";

export type ReportState = { status: "idle" } | { status: "sent" } | { status: "error"; message: string };

const schema = z.object({
  message: z.string().trim().min(5, "Décris un peu ce qui s'est passé.").max(4000, "C'est un peu long : 4 000 caractères au plus."),
  // A path of the CLHUB only, never a full URL from elsewhere.
  page: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/[^\s]*$/, "La page doit commencer par /, comme /jeux/loups.")
    .optional()
    .or(z.literal("")),
});

/** « Signaler un bug »: saved, and the admins are told by mail. */
export async function reportBugAction(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Connecte-toi d'abord." };
  const parsed = schema.safeParse({ message: formData.get("message"), page: formData.get("page") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Le signalement n'est pas valide." };
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await reportBug(session.member.id, { page: parsed.data.page || null, message: parsed.data.message, userAgent });
  return { status: "sent" };
}
