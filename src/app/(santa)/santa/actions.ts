"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import {
  LIMITS,
  addCohost,
  addExclusion,
  addGuestParticipant,
  addMemberParticipant,
  answerQuestion,
  archivedDraw,
  askQuestion,
  backToPreparation,
  createEvent,
  deleteEvent,
  getEventByCode,
  getMeView,
  getOrgView,
  launchEvent,
  redoNextYear,
  removeCohost,
  removeExclusion,
  removeParticipant,
  resendInvite,
  revealGift,
  saveLetter,
  setArchived,
  unmaskParticipant,
  updateGuest,
  updateSettings,
} from "@/modules/santa/data/events";
import { checkOrganizer } from "@/modules/santa/host";
import type { MeView, OrgView } from "@/modules/santa/views";

/** `values` puts back what was typed: React empties a form once its action has run, even on an error. */
export type FormState = { status: "idle" } | { status: "error"; message: string; values?: Record<string, string> };

export async function createSantaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const title = String(formData.get("title") ?? "").trim().slice(0, LIMITS.title);
  if (!title) return { status: "error", message: "Donne-lui un nom." };
  const event = await createEvent(session.member.id, title);
  redirect(`/santa/${event.code}/panneau`);
}

const id = z.string().uuid();
const name = z.string().trim().min(1, "Il manque un prénom.").max(LIMITS.name, "Prénom trop long.");
const email = z.string().trim().email("Cette adresse mail n'a pas l'air valide.");

const orgActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("settings"),
    title: z.string().trim().min(1, "Il faut un nom.").max(LIMITS.title, "Nom trop long."),
    budget: z.string().max(LIMITS.budget, "Budget trop long."),
    exchangeDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    message: z.string().max(LIMITS.message, "Message trop long."),
  }),
  z.object({ type: z.literal("addMember"), memberId: id }),
  z.object({ type: z.literal("addGuest"), name, email }),
  z.object({ type: z.literal("updateGuest"), id, name, email }),
  z.object({ type: z.literal("removeParticipant"), id }),
  z.object({ type: z.literal("addExclusion"), fromId: id, toId: id, mutual: z.boolean() }),
  z.object({ type: z.literal("removeExclusion"), id }),
  z.object({ type: z.literal("addCohost"), memberId: id }),
  z.object({ type: z.literal("removeCohost"), memberId: id }),
  z.object({ type: z.literal("launch") }),
  z.object({ type: z.literal("resend"), id }),
  z.object({ type: z.literal("backToPreparation") }),
  z.object({ type: z.literal("archive"), archived: z.boolean() }),
]);

export type OrgResult = { ok: true; view: OrgView } | { ok: false; error: string };

export async function santaOrgAction(code: string, action: unknown): Promise<OrgResult> {
  const check = await checkOrganizer(code);
  if (!check.ok) return { ok: false, error: "Tu n'organises pas ce Secret Santa." };
  const parsed = orgActionSchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };

  const event = check.event;
  const a = parsed.data;
  if ((a.type === "addCohost" || a.type === "removeCohost") && check.role !== "host") {
    return { ok: false, error: "Seule la personne qui l'a créé peut choisir ses co-organisateurs." };
  }
  const result = await (() => {
    switch (a.type) {
      case "settings":
        return updateSettings(event, a);
      case "addMember":
        return addMemberParticipant(event, a.memberId);
      case "addGuest":
        return addGuestParticipant(event, a.name, a.email);
      case "updateGuest":
        return updateGuest(event, a.id, a.name, a.email);
      case "removeParticipant":
        return removeParticipant(event, a.id);
      case "addExclusion":
        return addExclusion(event, a.fromId, a.toId, a.mutual);
      case "removeExclusion":
        return removeExclusion(event, a.id);
      case "addCohost":
        return addCohost(event, a.memberId);
      case "removeCohost":
        return removeCohost(event, a.memberId);
      case "launch":
        return launchEvent(event);
      case "resend":
        return resendInvite(event, a.id);
      case "backToPreparation":
        return backToPreparation(event);
      case "archive":
        return setArchived(event, a.archived);
    }
  })();
  if (!result.ok) return result;
  const fresh = await getEventByCode(code);
  return fresh ? { ok: true, view: await getOrgView(fresh) } : { ok: false, error: "Ce Secret Santa n'existe plus." };
}

/** The break-glass: who a participant drew. Leaves a trace in the panel. */
export async function santaUnmaskAction(code: string, participantId: string): Promise<{ ok: true; recipient: string; view: OrgView } | { ok: false; error: string }> {
  const check = await checkOrganizer(code);
  if (!check.ok) return { ok: false, error: "Tu n'organises pas ce Secret Santa." };
  if (!id.safeParse(participantId).success) return { ok: false, error: "Participant introuvable." };
  const result = await unmaskParticipant(check.event, participantId, check.memberId);
  return result.ok ? { ...result, view: await getOrgView(check.event) } : result;
}

/** The whole draw of an archived event, when its organizers ask for it. */
export async function santaArchiveDrawAction(code: string): Promise<{ giver: string; recipient: string }[]> {
  const check = await checkOrganizer(code);
  return check.ok ? archivedDraw(check.event) : [];
}

export async function santaNextYearAction(code: string): Promise<void> {
  const check = await checkOrganizer(code);
  if (!check.ok) redirect("/jeux/santa");
  const next = await redoNextYear(check.event, check.memberId);
  redirect(`/santa/${next.code}/panneau`);
}

export async function deleteSantaAction(code: string): Promise<void> {
  const check = await checkOrganizer(code);
  if (check.ok && check.role === "host") await deleteEvent(check.event);
  redirect("/jeux/santa");
}

const meActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reveal") }),
  z.object({ type: z.literal("letter"), letter: z.string().max(LIMITS.letter, "Ta lettre est trop longue pour le traîneau.") }),
  z.object({ type: z.literal("ask"), question: z.string().trim().min(1, "Écris ta question.").max(LIMITS.question, "Question trop longue.") }),
  z.object({ type: z.literal("answer"), id, answer: z.string().trim().min(1, "Écris ta réponse.").max(LIMITS.answer, "Réponse trop longue.") }),
]);

export type MeResult = { ok: true; view: MeView } | { ok: false; error: string };

/** Everything a participant does on their personal page: their secret link is their identity. */
export async function santaMeAction(token: string, action: unknown): Promise<MeResult> {
  const parsed = meActionSchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  const result =
    a.type === "reveal"
      ? await revealGift(token)
      : a.type === "letter"
        ? await saveLetter(token, a.letter)
        : a.type === "ask"
          ? await askQuestion(token, a.question)
          : await answerQuestion(token, a.id, a.answer);
  if (!result.ok) return result;
  const view = await getMeView(token);
  return view ? { ok: true, view } : { ok: false, error: "Lien inconnu." };
}
