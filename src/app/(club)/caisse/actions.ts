"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { logActivity } from "@/core/activity";
import {
  createExpenseEvent,
  addExpense,
  recordSettlement,
  getEventOwnerId,
  updateExpenseEvent,
  deleteExpenseEvent,
  getExpenseById,
  updateExpense,
  deleteExpense,
  deleteSettlement,
} from "@/modules/caisse/data/events";

const nameSchema = z.string().trim().min(1, "Donne un nom à cet évènement.").max(150);

export type CreateEventState = { status: "idle" } | { status: "error"; message: string };

export async function createEventAction(
  _prevState: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const nameParsed = nameSchema.safeParse(formData.get("name"));
  if (!nameParsed.success) {
    return { status: "error", message: nameParsed.error.issues[0]?.message ?? "Nom invalide." };
  }

  const participants: { memberId: string; shares: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("participant_") || value !== "on") continue;
    const memberId = key.slice("participant_".length);
    const sharesRaw = Number(formData.get(`shares_${memberId}`));
    const shares = Number.isFinite(sharesRaw) && sharesRaw > 0 ? Math.round(sharesRaw) : 1;
    participants.push({ memberId, shares });
  }
  if (participants.length === 0) {
    return { status: "error", message: "Choisis au moins un·e participant·e." };
  }

  const created = await createExpenseEvent(session.member.id, nameParsed.data, participants);

  await logActivity({
    section: "caisse",
    kind: "caisse.event-created",
    actorId: session.member.id,
    subjectRef: `expense-event:${created.id}`,
    payload: { name: created.name },
  });

  redirect(`/caisse/${created.id}`);
}

export type UpdateEventState = { status: "idle" } | { status: "error"; message: string };

/** Owner or admin — same split as recipe/item/don/menu editing. */
export async function updateEventAction(
  eventId: string,
  _prevState: UpdateEventState,
  formData: FormData,
): Promise<UpdateEventState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const ownerId = await getEventOwnerId(eventId);
  if (!ownerId) return { status: "error", message: "Cet évènement n'existe plus." };

  const isAdmin = await isAdminModeActive();
  if (ownerId !== session.member.id && !isAdmin) {
    return { status: "error", message: "Tu n'as pas le droit de modifier cet évènement." };
  }

  const nameParsed = nameSchema.safeParse(formData.get("name"));
  if (!nameParsed.success) {
    return { status: "error", message: nameParsed.error.issues[0]?.message ?? "Nom invalide." };
  }

  await updateExpenseEvent(eventId, nameParsed.data);

  revalidatePath(`/caisse/${eventId}`);
  revalidatePath("/caisse");
  redirect(`/caisse/${eventId}`);
}

/** Admin-mode only — same split as recipe/item/don/menu deletion. */
export async function deleteEventAction(eventId: string): Promise<void> {
  const isAdmin = await isAdminModeActive();
  if (!isAdmin) return;

  await deleteExpenseEvent(eventId);
  revalidatePath("/caisse");
  redirect("/caisse");
}

const expenseSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0.").max(1000000),
  description: z.string().trim().min(1, "Précise à quoi correspond cette dépense.").max(300),
  paidByMemberId: z.string().uuid("Choisis qui a payé."),
});

export type AddExpenseState = { status: "idle" } | { status: "error"; message: string };

export async function addExpenseAction(
  eventId: string,
  _prevState: AddExpenseState,
  formData: FormData,
): Promise<AddExpenseState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = expenseSchema.safeParse({
    amount: formData.get("amount"),
    description: formData.get("description"),
    paidByMemberId: formData.get("paidByMemberId"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await addExpense(eventId, {
    amountCents: Math.round(parsed.data.amount * 100),
    description: parsed.data.description,
    paidByMemberId: parsed.data.paidByMemberId,
    createdById: session.member.id,
  });

  revalidatePath(`/caisse/${eventId}`);
  return { status: "idle" };
}

export type UpdateExpenseState = { status: "idle" } | { status: "success" } | { status: "error"; message: string };

/** Owner (whoever logged it) or admin — same split as everywhere else. */
export async function updateExpenseAction(
  expenseId: string,
  eventId: string,
  _prevState: UpdateExpenseState,
  formData: FormData,
): Promise<UpdateExpenseState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const target = await getExpenseById(expenseId);
  if (!target) return { status: "error", message: "Cette dépense n'existe plus." };

  const isAdmin = await isAdminModeActive();
  if (target.createdById !== session.member.id && !isAdmin) {
    return { status: "error", message: "Tu n'as pas le droit de modifier cette dépense." };
  }

  const parsed = expenseSchema.safeParse({
    amount: formData.get("amount"),
    description: formData.get("description"),
    paidByMemberId: formData.get("paidByMemberId"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await updateExpense(expenseId, {
    amountCents: Math.round(parsed.data.amount * 100),
    description: parsed.data.description,
    paidByMemberId: parsed.data.paidByMemberId,
  });

  revalidatePath(`/caisse/${eventId}`);
  return { status: "success" };
}

/** Admin-mode only — same split as everywhere else. */
export async function deleteExpenseAction(expenseId: string, eventId: string): Promise<void> {
  const isAdmin = await isAdminModeActive();
  if (!isAdmin) return;

  await deleteExpense(expenseId);
  revalidatePath(`/caisse/${eventId}`);
}

const settlementSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0.").max(1000000),
});

export type RecordSettlementState = { status: "idle" } | { status: "error"; message: string };

export async function recordSettlementAction(
  eventId: string,
  _prevState: RecordSettlementState,
  formData: FormData,
): Promise<RecordSettlementState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = settlementSchema.safeParse({
    fromMemberId: formData.get("fromMemberId"),
    toMemberId: formData.get("toMemberId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  if (parsed.data.fromMemberId === parsed.data.toMemberId) {
    return { status: "error", message: "Ces deux personnes doivent être différentes." };
  }

  await recordSettlement(eventId, {
    fromMemberId: parsed.data.fromMemberId,
    toMemberId: parsed.data.toMemberId,
    amountCents: Math.round(parsed.data.amount * 100),
  });

  revalidatePath(`/caisse/${eventId}`);
  return { status: "idle" };
}

/**
 * Admin-mode only — settlements have no "who recorded this" field (unlike
 * expenses), so there's no owner to check against; edit is skipped entirely
 * (correcting a mis-typed amount is delete-and-re-record).
 */
export async function deleteSettlementAction(settlementId: string, eventId: string): Promise<void> {
  const isAdmin = await isAdminModeActive();
  if (!isAdmin) return;

  await deleteSettlement(settlementId);
  revalidatePath(`/caisse/${eventId}`);
}
