"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { typedEuros } from "@/core/money";
import { flash } from "@/core/ui/flash";
import {
  LIMITS,
  addEmailGuest,
  addExpense,
  addMemberGuest,
  assignTask,
  buildView,
  createEdition,
  declarePaid,
  deleteEdition,
  editionPath,
  expenseOwner,
  findByToken,
  getEditionByCode,
  guestOfMember,
  isOnTask,
  isOrganizer,
  itemCarer,
  removeCost,
  removeExpense,
  removeGuest,
  removeItem,
  removeList,
  removeMeal,
  removeOption,
  removeTask,
  saveCost,
  saveItem,
  saveList,
  saveMeal,
  saveOption,
  saveTask,
  sendInvitations,
  sendPaymentMails,
  setCohost,
  setItemCare,
  setReceived,
  setTaskStatus,
  updateAnswer,
  updateEmailGuest,
  updateSettings,
  type EditionView,
  type Result,
} from "@/modules/nouvel-an/data";

export type NyeResult = { ok: true; view: EditionView; info?: string } | { ok: false; error: string };

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisis une date.");
const text = (max: number) => z.string().trim().max(max);
const name = z.string().trim().min(1, "Écris un nom.").max(LIMITS.name);
const cents = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : typedEuros(v)),
  z.number({ error: "Écris un montant, par exemple 12,50." }).min(0, "Pas de montant négatif.").max(100000).transform((n) => Math.round(n * 100)),
);
const optionalCents = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : typedEuros(v)),
  z.number({ error: "Écris un prix, par exemple 10,29." }).min(0).max(100000).transform((n) => Math.round(n * 100)).nullable(),
);
const number = (max: number) => z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v), z.number({ error: "Écris un nombre." }).min(0).max(max));
const answer = z.enum(["pending", "yes", "maybe", "no"]);
const status = z.enum(["todo", "doing", "done"]);
const rule = z.enum(["fixed", "person", "person_day", "person_meal"]);
const split = z.enum(["presence", "equal", "options"]);
const lineKey = z.string().regex(/^(cost|list):[0-9a-f-]{36}$/).nullable();

// What a guest may do on their own page (and an organizer for them).
const guestMoves = [
  z.object({ type: z.literal("answer"), guestId: uuid.optional(), answer: answer.optional(), days: z.array(day).max(31).nullable().optional(), optionId: uuid.nullable().optional(), diet: text(LIMITS.short).optional(), note: text(LIMITS.short).optional() }),
  z.object({ type: z.literal("takeTask"), taskId: uuid, guestId: uuid.optional(), on: z.boolean() }),
  z.object({ type: z.literal("taskStatus"), taskId: uuid, status }),
  z.object({ type: z.literal("takeItem"), itemId: uuid, guestId: uuid.nullable().optional(), on: z.boolean() }),
  z.object({ type: z.literal("itemBought"), itemId: uuid, bought: z.boolean() }),
  z.object({ type: z.literal("addExpense"), guestId: uuid.optional(), label: z.string().trim().min(1, "Dis ce que c'était.").max(LIMITS.short), cents: cents.refine((c) => c > 0, "Écris le montant payé."), lineKey }),
  z.object({ type: z.literal("removeExpense"), id: uuid }),
  z.object({ type: z.literal("declarePaid"), guestId: uuid.optional(), paid: z.boolean() }),
] as const;

const orgSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refresh") }),
  ...guestMoves,
  z.object({
    type: z.literal("settings"),
    title: z.string().trim().min(1, "Donne un titre.").max(LIMITS.title),
    startsOn: day,
    endsOn: day,
    place: text(LIMITS.short),
    message: text(LIMITS.text),
    paymentInfo: text(LIMITS.short),
    headcountOverride: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(1).max(500).nullable()),
  }),
  z.object({ type: z.literal("cohost"), memberId: uuid, on: z.boolean() }),
  z.object({ type: z.literal("addMember"), memberId: uuid }),
  z.object({ type: z.literal("addEmail"), name, email: z.string().trim().email("Cette adresse ne ressemble pas à une adresse mail.").max(200) }),
  z.object({ type: z.literal("editEmail"), guestId: uuid, name, email: z.string().trim().email("Cette adresse ne ressemble pas à une adresse mail.").max(200) }),
  z.object({ type: z.literal("removeGuest"), guestId: uuid }),
  z.object({ type: z.literal("invite"), guestIds: z.array(uuid).max(LIMITS.guests).nullable() }),
  z.object({ type: z.literal("payMails"), kind: z.enum(["request", "reminder"]) }),
  z.object({ type: z.literal("received"), guestId: uuid, cents }),
  z.object({ type: z.literal("option"), id: uuid.nullable(), label: name, priceCents: cents }),
  z.object({ type: z.literal("removeOption"), id: uuid }),
  z.object({ type: z.literal("meal"), id: uuid.nullable(), day, label: name, menu: text(LIMITS.text) }),
  z.object({ type: z.literal("removeMeal"), id: uuid }),
  z.object({ type: z.literal("task"), id: uuid.nullable(), pole: name, title: z.string().trim().min(1, "Dis ce qu'il y a à faire.").max(LIMITS.short), due: text(60), status, note: text(LIMITS.short) }),
  z.object({ type: z.literal("removeTask"), id: uuid }),
  z.object({ type: z.literal("list"), id: uuid.nullable(), name, split: z.enum(["presence", "equal"]) }),
  z.object({ type: z.literal("removeList"), id: uuid }),
  z.object({
    type: z.literal("item"),
    id: uuid.nullable(),
    listId: uuid,
    name,
    rule,
    ratio: number(10000),
    unit: text(60),
    perPack: z.preprocess((v) => (v === "" || v === undefined ? 1 : Number(v)), z.number().int("Un nombre entier par lot.").min(1).max(10000)),
    packPriceCents: optionalCents,
    stock: number(100000),
    overridePacks: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int("Un nombre entier.").min(0).max(100000).nullable()),
  }),
  z.object({ type: z.literal("removeItem"), id: uuid }),
  z.object({ type: z.literal("cost"), id: uuid.nullable(), label: name, cents, split }),
  z.object({ type: z.literal("removeCost"), id: uuid }),
]);

type OrgInput = z.infer<typeof orgSchema>;
type GuestInput = Extract<OrgInput, { type: (typeof guestMoves)[number]["shape"]["type"]["value"] }>;

const guestSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("refresh") }), ...guestMoves]);

async function me() {
  const session = await getSession();
  return session ? { id: session.member.id, name: session.user.name || "Quelqu'un" } : null;
}

/** A guest's own moves: on their own row only (an organizer passes the guest it is for). */
async function guestMove(e: NonNullable<Awaited<ReturnType<typeof getEditionByCode>>>, self: string, a: GuestInput, organizer: boolean): Promise<Result> {
  const who = organizer && "guestId" in a && a.guestId ? a.guestId : self;
  switch (a.type) {
    case "answer":
      return updateAnswer(e, who, a);
    case "takeTask":
      return assignTask(e, a.taskId, who, a.on);
    case "taskStatus":
      if (!organizer && !(await isOnTask(a.taskId, self))) return { ok: false, error: "Seuls ceux qui s'en chargent changent son avancement." };
      return setTaskStatus(e, a.taskId, a.status);
    case "takeItem": {
      const carer = await itemCarer(e, a.itemId);
      if (carer === undefined) return { ok: false, error: "Article introuvable." };
      if (!organizer && carer && carer !== self) return { ok: false, error: "Quelqu'un s'en occupe déjà." };
      return setItemCare(e, a.itemId, { guestId: a.on ? (organizer && a.guestId !== undefined ? a.guestId : self) : null });
    }
    case "itemBought": {
      const carer = await itemCarer(e, a.itemId);
      if (!organizer && carer !== self) return { ok: false, error: "Seul celui qui s'en occupe le coche." };
      return setItemCare(e, a.itemId, { bought: a.bought });
    }
    case "addExpense":
      return addExpense(e, { guestId: who, label: a.label, cents: a.cents, lineKey: a.lineKey });
    case "removeExpense":
      if (!organizer && (await expenseOwner(e, a.id)) !== self) return { ok: false, error: "Ce n'est pas ta dépense." };
      return removeExpense(e, a.id);
    case "declarePaid":
      return declarePaid(e, who, a.paid);
  }
}

/** Everything the organizers do; each call answers with the edition as it now is. */
export async function nyeOrgAction(code: string, input: unknown): Promise<NyeResult> {
  const m = await me();
  const e = await getEditionByCode(code);
  if (!m || !e || !(await isOrganizer(e, m.id))) return { ok: false, error: "Ce nouvel an n'est pas à toi." };
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  const self = (await guestOfMember(e, m.id))?.id ?? "";
  let info: string | undefined;
  const r: Result = await (async (): Promise<Result> => {
    switch (a.type) {
      case "refresh":
        return { ok: true };
      case "settings":
        return updateSettings(e, a);
      case "cohost":
        if (e.hostMemberId !== m.id) return { ok: false, error: "Seule la personne qui a créé l'édition choisit les co-organisateurs." };
        return setCohost(e, a.memberId, a.on);
      case "addMember":
        return addMemberGuest(e, a.memberId);
      case "addEmail":
        return addEmailGuest(e, a.name, a.email);
      case "editEmail":
        return updateEmailGuest(e, a.guestId, a.name, a.email);
      case "removeGuest":
        return removeGuest(e, a.guestId);
      case "invite": {
        const res = await sendInvitations(e, m.name, a.guestIds);
        if (res.ok) info = res.sent ? `${res.sent} invitation${res.sent > 1 ? "s" : ""} envoyée${res.sent > 1 ? "s" : ""}` : "Tout le monde est déjà invité";
        return res.ok ? { ok: true } : res;
      }
      case "payMails": {
        const res = await sendPaymentMails(e, a.kind);
        if (res.ok) info = `${res.sent} ${a.kind === "request" ? "demande" : "relance"}${res.sent > 1 ? "s" : ""} envoyée${res.sent > 1 ? "s" : ""}`;
        return res.ok ? { ok: true } : res;
      }
      case "received":
        return setReceived(e, a.guestId, a.cents);
      case "option":
        return saveOption(e, a);
      case "removeOption":
        return removeOption(e, a.id);
      case "meal":
        return saveMeal(e, a);
      case "removeMeal":
        return removeMeal(e, a.id);
      case "task":
        return saveTask(e, a);
      case "removeTask":
        return removeTask(e, a.id);
      case "list":
        return saveList(e, a);
      case "removeList":
        return removeList(e, a.id);
      case "item":
        return saveItem(e, a);
      case "removeItem":
        return removeItem(e, a.id);
      case "cost":
        return saveCost(e, a);
      case "removeCost":
        return removeCost(e, a.id);
      default:
        return guestMove(e, self, a, true);
    }
  })();
  if (!r.ok) return r;
  const fresh = (await getEditionByCode(code))!; // just read above: the edition is there
  return { ok: true, view: await buildView(fresh, { organizer: true, memberId: m.id, guest: await guestOfMember(fresh, m.id) }), info };
}

/** A guest's page, through their personal link: no account needed. */
export async function nyeGuestAction(token: string, input: unknown): Promise<NyeResult> {
  const found = await findByToken(token);
  if (!found) return { ok: false, error: "Ce lien ne mène plus nulle part." };
  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  if (a.type !== "refresh") {
    const r = await guestMove(found.edition, found.guest.id, a, false);
    if (!r.ok) return r;
  }
  const again = (await findByToken(token))!; // the guest was found just above
  return { ok: true, view: await buildView(again.edition, { organizer: false, memberId: again.guest.memberId, guest: again.guest }) };
}

export type NewEditionState = { status: "idle" } | { status: "error"; message: string };

const newSchema = z.object({ title: z.string().trim().min(1, "Donne un titre.").max(LIMITS.title), startsOn: day, endsOn: day, from: z.string().regex(/^[A-Z0-9]{6}$/).or(z.literal("")) });

export async function createEditionAction(_prev: NewEditionState, formData: FormData): Promise<NewEditionState> {
  const m = await me();
  if (!m) redirect("/sign-in");
  const parsed = newSchema.safeParse({ title: formData.get("title"), startsOn: formData.get("startsOn"), endsOn: formData.get("endsOn"), from: formData.get("from") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire incomplet." };
  const res = await createEdition({ hostId: m.id, title: parsed.data.title, startsOn: parsed.data.startsOn, endsOn: parsed.data.endsOn, fromCode: parsed.data.from || null });
  if (!res.ok) return { status: "error", message: res.error };
  revalidatePath("/celebrer");
  await flash(parsed.data.from ? "Nouvel an créé : la liste d'invités et l'organisation de l'an dernier sont reprises" : "Nouvel an créé");
  redirect(editionPath(res.code));
}

export async function deleteEditionAction(code: string): Promise<void> {
  const m = await me();
  const e = await getEditionByCode(code);
  if (m && e && e.hostMemberId === m.id) await deleteEdition(e);
  revalidatePath("/celebrer");
  await flash("Nouvel an supprimé");
  redirect("/celebrer/nouvel-an");
}
