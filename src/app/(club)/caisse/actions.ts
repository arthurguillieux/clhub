"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { logActivity } from "@/core/activity";
import { createExpenseEvent, addExpense, recordSettlement } from "@/modules/caisse/data/events";

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
