"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { logActivity } from "@/core/activity";
import { TEMPLATES } from "@/modules/repas/domain/templates";
import {
  addItem,
  addSelf,
  applyProposals,
  claimGuest,
  claimItem,
  createMeal,
  deleteMeal,
  duplicateMeal,
  getMealView,
  inviteGuests,
  joinMeal,
  nudge,
  openCaisse,
  removeGuest,
  removeItem,
  setBought,
  setResponse,
  unclaimItem,
  updateItem,
  updateMeal,
  type MealView,
  type Result,
} from "@/modules/repas/data/meals";
import { cookieName, resolve, type MealRef } from "./load";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const mealFields = {
  title: z.string().trim().min(1, "Donne un nom à ce repas.").max(150),
  date: isoDate,
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  place: optText(120),
  note: optText(1000),
  open: z.boolean(),
};

// ───────── A new meal ─────────

export type CreateMealState = { status: "idle" } | { status: "error"; message: string };

export async function createMealAction(_prev: CreateMealState, formData: FormData): Promise<CreateMealState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };
  const parsed = z.object(mealFields).safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    time: formData.get("time") ?? "",
    place: formData.get("place"),
    note: formData.get("note"),
    open: formData.get("open") === "on",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const meal = await createMeal(session.member.id, session.user.name, parsed.data);
  // Only an open meal is news for the whole club; an invitation stays between its guests.
  if (meal.open) await logActivity({ section: "menus", kind: "menu.proposed", actorId: session.member.id, subjectRef: `menu:${meal.id}`, payload: { title: meal.title, eventDate: meal.eventDate } });
  redirect(`/repas/${meal.id}`);
}

// ───────── Everything else on a meal's page ─────────

const id = z.string().uuid();
const category = z.enum(["manger", "boire", "materiel"]);
const itemFields = {
  label: z.string().trim().min(1, "Il manque le nom de la ligne.").max(120),
  quantity: z.number().positive().max(100000).nullable(),
  unit: z.string().trim().max(20).nullable(),
  category,
};

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refresh") }),
  z.object({ type: z.literal("respond"), status: z.enum(["yes", "maybe", "no"]), plusOnes: z.number().int().min(0).max(10), vege: z.boolean().nullable() }),
  z.object({ type: z.literal("join") }),
  z.object({ type: z.literal("iam"), guestId: id }),
  z.object({ type: z.literal("notme") }),
  z.object({ type: z.literal("addSelf"), name: z.string().trim().min(1, "Il manque ton prénom.").max(40) }),
  z.object({ type: z.literal("addItem"), ...itemFields }),
  z.object({ type: z.literal("updateItem"), itemId: id, ...itemFields }),
  z.object({ type: z.literal("removeItem"), itemId: id }),
  z.object({ type: z.literal("claim"), itemId: id, quantity: z.union([z.literal("all"), z.number().positive().max(100000)]) }),
  z.object({ type: z.literal("unclaim"), itemId: id }),
  z.object({ type: z.literal("bought"), claimId: id, bought: z.boolean() }),
  z.object({ type: z.literal("update"), ...mealFields }),
  z.object({ type: z.literal("invite"), memberIds: z.array(id).max(60), names: z.array(z.string().max(40)).max(40) }),
  z.object({ type: z.literal("removeGuest"), guestId: id }),
  z.object({
    type: z.literal("apply"),
    template: z.enum(TEMPLATES.map((t) => t.id) as [string, ...string[]]),
    proposals: z.array(z.object({ label: z.string().trim().min(1).max(120), emoji: z.string().max(12), category, quantity: z.number().positive().max(100000), unit: z.string().max(20) })).max(40),
  }),
  z.object({ type: z.literal("nudge") }),
  z.object({ type: z.literal("caisse") }),
  z.object({ type: z.literal("duplicate"), date: isoDate }),
  z.object({ type: z.literal("delete") }),
]);

export type MealResult = { ok: true; view: MealView; info?: string; go?: string } | { ok: false; error: string };

export async function mealAction(ref: MealRef, input: unknown): Promise<MealResult> {
  const r = await resolve(ref);
  if (!r) return { ok: false, error: "Ce repas n'existe plus, ou il est sur invitation." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  const { meal, session, admin } = r;
  let actor = r.actor;
  let info: string | undefined;
  let go: string | undefined;
  const needGuest = () => (actor.guest ? null : "Dis d'abord qui tu es.");
  const needOrganizer = () => (actor.organizer ? null : "Seul l'organisateur peut faire ça.");
  const store = async (key: string) => (await cookies()).set(cookieName(meal), key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/repas", maxAge: 60 * 60 * 24 * 365 });

  const result: Result = await (async (): Promise<Result> => {
    switch (a.type) {
      case "refresh":
        return { ok: true };
      case "respond": {
        const no = needGuest();
        return no ? { ok: false, error: no } : setResponse(meal, actor.guest!, a);
      }
      case "join":
        if (!session) return { ok: false, error: "Connecte-toi pour te joindre au repas." };
        return joinMeal(meal, session.member.id, session.user.name);
      case "iam": {
        const done = await claimGuest(meal, a.guestId);
        if (!done.ok) return done;
        await store(done.key);
        return { ok: true };
      }
      case "notme":
        (await cookies()).delete({ name: cookieName(meal), path: "/repas" });
        actor = { ...actor, guest: session ? actor.guest : null };
        return { ok: true };
      case "addSelf": {
        const done = await addSelf(meal, a.name);
        if (!done.ok) return done;
        await store(done.key);
        return { ok: true };
      }
      case "addItem":
        if (!actor.organizer && !actor.guest) return { ok: false, error: "Dis d'abord qui tu es." };
        return addItem(meal, actor.guest, a);
      case "updateItem":
        return updateItem(meal, actor, a.itemId, a);
      case "removeItem":
        return removeItem(meal, actor, a.itemId);
      case "claim": {
        const no = needGuest();
        return no ? { ok: false, error: no } : claimItem(meal, actor.guest!, a.itemId, a.quantity);
      }
      case "unclaim": {
        const no = needGuest();
        return no ? { ok: false, error: no } : unclaimItem(actor.guest!, a.itemId);
      }
      case "bought": {
        const no = needGuest();
        return no ? { ok: false, error: no } : setBought(actor.guest!, a.claimId, a.bought);
      }
      case "update": {
        const no = needOrganizer();
        return no ? { ok: false, error: no } : updateMeal(meal, a);
      }
      case "invite": {
        const no = needOrganizer();
        return no ? { ok: false, error: no } : inviteGuests(meal, session?.user.name ?? "L'organisateur", { memberIds: a.memberIds, names: a.names });
      }
      case "removeGuest": {
        const no = needOrganizer();
        return no ? { ok: false, error: no } : removeGuest(meal, a.guestId);
      }
      case "apply": {
        const no = needOrganizer();
        return no ? { ok: false, error: no } : applyProposals(meal, a.template, a.proposals);
      }
      case "nudge": {
        const no = needOrganizer();
        if (no) return { ok: false, error: no };
        const done = await nudge(meal);
        info = done.count ? `${done.count} ${done.count > 1 ? "invités relancés" : "invité relancé"}.` : "Tout le monde a déjà choisi ce qu'il ramène (ou n'a pas de compte à relancer).";
        return { ok: true };
      }
      case "caisse": {
        const no = needOrganizer();
        if (no) return { ok: false, error: no };
        const done = await openCaisse(meal);
        if (!done.ok) return done;
        go = `/caisse/${done.id}`;
        return { ok: true };
      }
      case "duplicate": {
        const no = needOrganizer();
        if (no) return { ok: false, error: no };
        const copy = await duplicateMeal(meal, a.date);
        go = `/repas/${copy.id}`;
        return { ok: true };
      }
      case "delete":
        if (!admin) return { ok: false, error: "Seul un admin peut supprimer un repas." };
        await deleteMeal(meal);
        go = "/repas";
        return { ok: true };
    }
  })();
  if (!result.ok) return result;
  revalidatePath("/repas");
  if (go === "/repas") return { ok: true, view: await getMealView(meal, actor), go };
  const fresh = await resolve(ref);
  if (!fresh) return { ok: false, error: "Ce repas n'existe plus." };
  return { ok: true, view: await getMealView(fresh.meal, fresh.actor), info, go };
}
