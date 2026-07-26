"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { logActivity } from "@/core/activity";
import { createNotification } from "@/core/notifications";
import {
  createMenuEvent,
  getMenuEventOwnerId,
  submitResponse,
} from "@/modules/menus/data/menuEvents";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

const createSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom à ce repas.").max(150),
  eventDate: isoDate,
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type CreateMenuEventState = { status: "idle" } | { status: "error"; message: string };

export async function createMenuEventAction(
  _prevState: CreateMenuEventState,
  formData: FormData,
): Promise<CreateMenuEventState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    eventDate: formData.get("eventDate"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const created = await createMenuEvent(session.member.id, parsed.data);

  await logActivity({
    section: "menus",
    kind: "menu.proposed",
    actorId: session.member.id,
    subjectRef: `menu:${created.id}`,
    payload: { title: created.title, eventDate: created.eventDate },
  });

  redirect(`/menus/${created.id}`);
}

const responseSchema = z.object({
  attending: z.enum(["yes", "no"]),
  bringing: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : null)),
  allergies: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type SubmitResponseState = { status: "idle" } | { status: "success" } | { status: "error"; message: string };

export async function submitResponseAction(
  eventId: string,
  _prevState: SubmitResponseState,
  formData: FormData,
): Promise<SubmitResponseState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = responseSchema.safeParse({
    attending: formData.get("attending"),
    bringing: formData.get("bringing"),
    allergies: formData.get("allergies"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const attending = parsed.data.attending === "yes";
  await submitResponse(eventId, session.member.id, {
    attending,
    bringing: parsed.data.bringing,
    allergies: parsed.data.allergies,
  });

  const ownerId = await getMenuEventOwnerId(eventId);
  if (ownerId && ownerId !== session.member.id && attending) {
    await createNotification({
      memberId: ownerId,
      kind: "menu.response",
      entityRef: `menu:${eventId}`,
      payload: { memberName: session.user.name },
    });
  }

  revalidatePath(`/menus/${eventId}`);
  return { status: "success" };
}
