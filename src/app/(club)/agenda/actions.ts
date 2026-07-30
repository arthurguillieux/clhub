"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { logActivity } from "@/core/activity";
import {
  createClubEvent,
  deleteClubEvent,
  getClubEventOwnerId,
  updateClubEvent,
} from "@/modules/agenda/data/clubEvents";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

const createSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom à cet évènement.").max(150),
  eventDate: isoDate,
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type CreateClubEventState = { status: "idle" } | { status: "error"; message: string };

export async function createClubEventAction(
  _prevState: CreateClubEventState,
  formData: FormData,
): Promise<CreateClubEventState> {
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

  const created = await createClubEvent(session.member.id, parsed.data);

  await logActivity({
    section: "agenda",
    kind: "club-event.added",
    actorId: session.member.id,
    subjectRef: `club-event:${created.id}`,
    payload: { title: created.title, eventDate: created.eventDate },
  });

  revalidatePath("/agenda");
  redirect(`/agenda?month=${created.eventDate}`);
}

export type UpdateClubEventState = { status: "idle" } | { status: "error"; message: string };

/** Creator or admin — same split as delete below. */
export async function updateClubEventAction(
  eventId: string,
  _prevState: UpdateClubEventState,
  formData: FormData,
): Promise<UpdateClubEventState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const ownerId = await getClubEventOwnerId(eventId);
  if (!ownerId) return { status: "error", message: "Cet évènement n'existe plus." };

  const isAdmin = await isAdminModeActive();
  if (ownerId !== session.member.id && !isAdmin) {
    return { status: "error", message: "Tu n'as pas le droit de modifier cet évènement." };
  }

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    eventDate: formData.get("eventDate"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await updateClubEvent(eventId, parsed.data);

  revalidatePath("/agenda");
  redirect(`/agenda?month=${parsed.data.eventDate}`);
}

/** Creator or admin — same split as recipe editing, there's no self-service delete for anyone else. */
export async function deleteClubEventAction(eventId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const ownerId = await getClubEventOwnerId(eventId);
  if (!ownerId) return;

  const isAdmin = await isAdminModeActive();
  if (ownerId !== session.member.id && !isAdmin) return;

  await deleteClubEvent(eventId);
  revalidatePath("/agenda");
}
