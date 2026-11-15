"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { fetchOpenGraphMetadata } from "@/core/opengraph";
import { LIMITS, parseEuros } from "@/modules/lettre/domain/letter";
import {
  addCohost,
  addGift,
  createLetter,
  deleteLetter,
  duplicateLetter,
  getFamilyView,
  getLetterByCode,
  getLetterByToken,
  getOrgView,
  joinOrganization,
  noteOffer,
  offerFromFamily,
  previewLink,
  removeCohost,
  removeGift,
  removeOffer,
  saveThanks,
  setClosed,
  setCohostPassword,
  setPhoto,
  setReceived,
  shareLetter,
  updateGift,
  updateLetter,
  withdrawFromFamily,
  type PhotoChange,
  type Result,
} from "@/modules/lettre/data/letters";
import { checkOrganizer } from "@/modules/lettre/host";
import type { FamilyView, OrgView } from "@/modules/lettre/views";
import { ensureVisitorKey, readVisitorKey } from "./visitor";

/** `values` puts back what was typed: React empties a form once its action has run, even on an error. */
export type FormState = { status: "idle" } | { status: "error"; message: string; values?: Record<string, string> };

const yearSchema = z.coerce.number().int().min(2020, "Cette année n'a pas l'air juste.").max(2100, "Cette année n'a pas l'air juste.");
const childNameSchema = z.string().trim().min(1, "Il manque le prénom de l'enfant.").max(LIMITS.childName, "Prénom trop long.");

export async function createLetterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const values = { childName: String(formData.get("childName") ?? ""), year: String(formData.get("year") ?? "") };
  const childName = childNameSchema.safeParse(values.childName);
  if (!childName.success) return { status: "error", message: childName.error.issues[0]?.message ?? "Prénom invalide.", values };
  const year = yearSchema.safeParse(values.year);
  if (!year.success) return { status: "error", message: year.error.issues[0]?.message ?? "Année invalide.", values };
  const created = await createLetter(session.member.id, childName.data, year.data);
  redirect(`/lettre/${created.code}/panneau`);
}

/** A member joins the organization of a letter with its code and co-organization password. */
export async function joinLetterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const found = code ? await getLetterByCode(code) : null;
  if (!found) return { status: "error", message: "Aucune lettre ne porte ce code.", values: { code } };
  const result = await joinOrganization(found, session.member.id, String(formData.get("password") ?? ""));
  if (!result.ok) return { status: "error", message: result.error, values: { code } };
  redirect(`/lettre/${found.code}/panneau`);
}

const id = z.string().uuid();

/** A picture resized by the browser before it's sent (see ImagePicker): a data URL, well under the 1 MB an action accepts. */
const dataUrl = z
  .string()
  .max(1_000_000, "Cette photo est trop lourde.")
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Cette image ne s'ouvre pas.");

const toBuffer = (url: string) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");

const euroAmount = z
  .string()
  .max(20)
  .transform((text, ctx) => {
    if (!text.trim()) return null;
    const cents = parseEuros(text);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Ce montant n'a pas l'air juste : écris par exemple 35 ou 35,90." });
      return z.NEVER;
    }
    return cents;
  });

const giftFields = {
  title: z.string().trim().min(1, "Donne un nom au cadeau.").max(LIMITS.giftTitle, "Nom trop long."),
  url: z
    .string()
    .trim()
    .max(LIMITS.url, "Lien trop long.")
    .refine((u) => u === "" || /^https?:\/\/[^\s]+$/i.test(u), "Ce lien n'a pas l'air d'une adresse web (https://…).")
    .transform((u) => u || null),
  price: euroAmount,
  note: z.string().trim().max(LIMITS.note, "Note trop longue."),
  secondHand: z.boolean(),
  favorite: z.boolean(),
  copies: z.number().int().min(1).max(LIMITS.copies).nullable(),
  pot: z.boolean(),
  photo: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("keep") }),
    z.object({ kind: z.literal("remove") }),
    z.object({ kind: z.literal("data"), dataUrl }),
    z.object({ kind: z.literal("stored"), id }),
  ]),
};

const orgActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refresh") }),
  z.object({
    type: z.literal("letter"),
    childName: childNameSchema,
    year: yearSchema,
    words: z.string().max(LIMITS.words, "La lettre est trop longue pour le traîneau."),
    advice: z.string().max(LIMITS.advice, "« Bon à savoir » est trop long."),
    payNote: z.string().max(LIMITS.payNote, "Le mot pour la cagnotte est trop long."),
  }),
  z.object({ type: z.literal("photo"), which: z.enum(["child", "thanks"]), dataUrl: dataUrl.nullable() }),
  z.object({ type: z.literal("addGift"), ...giftFields }),
  z.object({ type: z.literal("updateGift"), id, ...giftFields }),
  z.object({ type: z.literal("removeGift"), id }),
  z.object({ type: z.literal("share") }),
  z.object({ type: z.literal("close"), closed: z.boolean() }),
  z.object({ type: z.literal("thanks"), text: z.string().max(LIMITS.thanks, "Le merci est trop long."), publish: z.boolean() }),
  z.object({ type: z.literal("noteOffer"), giftId: id, name: z.string().trim().min(1, "Il manque le prénom.").max(LIMITS.name, "Prénom trop long."), amount: euroAmount }),
  z.object({ type: z.literal("removeOffer"), id }),
  z.object({ type: z.literal("received"), id, received: z.boolean() }),
  z.object({ type: z.literal("cohostPassword"), password: z.string().max(100).nullable() }),
  z.object({ type: z.literal("addCohost"), memberId: id }),
  z.object({ type: z.literal("removeCohost"), memberId: id }),
]);

export type OrgResult = { ok: true; view: OrgView } | { ok: false; error: string };

const CREATOR_ONLY = new Set(["cohostPassword", "addCohost", "removeCohost"]);

/** Everything the organizers do on the letter's page; each call answers with the page as it now is (`refresh` only asks for it). */
export async function letterOrgAction(code: string, action: unknown): Promise<OrgResult> {
  const check = await checkOrganizer(code);
  if (!check.ok) return { ok: false, error: "Tu n'organises pas cette lettre." };
  const parsed = orgActionSchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  if (CREATOR_ONLY.has(a.type) && check.role !== "host") return { ok: false, error: "Seule la personne qui a créé la lettre peut faire ça." };
  const l = check.letter;

  const photoChange = (photo: z.infer<typeof giftFields.photo>): PhotoChange => (photo.kind === "data" ? { kind: "data", data: toBuffer(photo.dataUrl) } : photo);
  const giftInput = (g: { title: string; url: string | null; price: number | null; note: string; secondHand: boolean; favorite: boolean; copies: number | null; pot: boolean }) => ({
    title: g.title,
    url: g.url,
    priceCents: g.price,
    note: g.note,
    secondHand: g.secondHand,
    favorite: g.favorite,
    copies: g.pot ? 1 : g.copies,
    pot: g.pot,
  });

  const result: Result = await (async () => {
    switch (a.type) {
      case "refresh":
        return { ok: true };
      case "letter":
        return updateLetter(l, { childName: a.childName, year: a.year, words: a.words, advice: a.advice, payNote: a.payNote });
      case "photo":
        return setPhoto(l, a.which, a.dataUrl ? toBuffer(a.dataUrl) : null);
      case "addGift":
        return addGift(l, giftInput(a), photoChange(a.photo));
      case "updateGift":
        return updateGift(l, a.id, giftInput(a), photoChange(a.photo));
      case "removeGift":
        return removeGift(l, a.id);
      case "share":
        return shareLetter(l);
      case "close":
        return setClosed(l, a.closed);
      case "thanks":
        return saveThanks(l, a.text, a.publish);
      case "noteOffer":
        return noteOffer(l, a.giftId, a.name, a.amount, check.memberId);
      case "removeOffer":
        return removeOffer(l, a.id, check.memberId);
      case "received":
        return setReceived(l, a.id, a.received);
      case "cohostPassword":
        return setCohostPassword(l, a.password);
      case "addCohost":
        return addCohost(l, a.memberId);
      case "removeCohost":
        return removeCohost(l, a.memberId);
    }
  })();
  if (!result.ok) return result;
  const fresh = await getLetterByCode(code);
  return fresh ? { ok: true, view: await getOrgView(fresh) } : { ok: false, error: "Cette lettre n'existe plus." };
}

export type PreviewResult = { ok: true; title: string | null; price: string | null; photo: { id: string; url: string } | null } | { ok: false; error: string };

/** « Remplir avec ce lien »: what a shop's page says about the gift, its picture already fetched. */
export async function letterPreviewAction(code: string, url: string): Promise<PreviewResult> {
  const check = await checkOrganizer(code);
  if (!check.ok) return { ok: false, error: "Tu n'organises pas cette lettre." };
  if (!z.string().url().max(LIMITS.url).safeParse(url).success || !/^https?:\/\//i.test(url)) return { ok: false, error: "Colle l'adresse complète de la page, qui commence par https://" };
  const meta = await fetchOpenGraphMetadata(url);
  if (!meta) return { ok: false, error: "Ce site ne se laisse pas lire : remplis la fiche à la main, le lien sera quand même gardé." };
  const preview = await previewLink(check.letter, meta);
  return { ok: true, title: preview.title, price: preview.priceCents !== null ? (preview.priceCents / 100).toFixed(2).replace(".", ",").replace(",00", "") : null, photo: preview.photo };
}

export async function letterNextYearAction(code: string, carry: boolean): Promise<void> {
  const check = await checkOrganizer(code);
  if (!check.ok) redirect("/jeux/lettre");
  const next = await duplicateLetter(check.letter, check.memberId, carry === true);
  redirect(`/lettre/${next.code}/panneau`);
}

export async function deleteLetterAction(code: string): Promise<void> {
  const check = await checkOrganizer(code);
  if (check.ok && check.role === "host") await deleteLetter(check.letter);
  redirect("/jeux/lettre");
}

// ───────── The family ─────────

const familySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refresh") }),
  z.object({
    type: z.literal("offer"),
    giftId: id,
    name: z.string().trim().min(1, "Indiquez votre prénom : c'est ce que verront les autres.").max(LIMITS.name, "Prénom trop long."),
    amount: euroAmount.nullable(),
  }),
  z.object({ type: z.literal("withdraw"), id }),
]);

export type FamilyResult = { ok: true; view: FamilyView } | { ok: false; error: string; view?: FamilyView };

async function familyView(token: string, visitorKey: string | null): Promise<FamilyView | null> {
  const l = await getLetterByToken(token);
  return l ? getFamilyView(l, visitorKey, !l.sharedAt) : null;
}

/** What the family does from the letter's link, no account needed. A refused offer still brings the list up to date. */
export async function letterFamilyAction(token: string, action: unknown): Promise<FamilyResult> {
  const parsed = familySchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  if (a.type === "refresh") {
    const view = await familyView(token, await readVisitorKey());
    return view ? { ok: true, view } : { ok: false, error: "Ce lien ne mène nulle part." };
  }
  const visitorKey = await ensureVisitorKey();
  const result = a.type === "offer" ? await offerFromFamily(token, visitorKey, a.giftId, a.name, a.amount) : await withdrawFromFamily(token, visitorKey, a.id);
  const view = await familyView(token, visitorKey);
  if (!result.ok) return { ok: false, error: result.error, view: view ?? undefined };
  return view ? { ok: true, view } : { ok: false, error: "Ce lien ne mène nulle part." };
}
