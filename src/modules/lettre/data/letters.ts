import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { letter, letterCohost, letterGift, letterOffer, member, user, type Letter, type LetterGift, type LetterOffer } from "@/core/db/schema";
import { hashPassword, verifyPassword } from "@/core/auth/sharedPassword";
import { downloadImage } from "@/core/opengraph";
import { LIMITS, byWish, cleanName, letterTitle, pledgeError, progressOf, stageOf, untaken } from "../domain/letter";
import type { FamilyView, GiftView, OrgView } from "../views";
import { copyImage, deleteImage, deleteOrphanImages, imageBelongs, imageUrl, storeImage } from "./images";
import { notifyOrganizers } from "./notify";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

const newToken = () => randomBytes(24).toString("base64url");
export const familyLink = (token: string) => `${process.env.APP_URL ?? "http://localhost:3000"}/lettre/ouvrir/${token}`;
export const titleOf = (l: Pick<Letter, "childName" | "year">) => letterTitle(l.childName, l.year);

const BAD_PICTURE = "Cette image ne s'ouvre pas : essaie une photo en JPEG ou en PNG.";

// ───────── Reading ─────────

export async function getLetterByCode(code: string): Promise<Letter | null> {
  const [row] = await db.select().from(letter).where(eq(letter.code, code.trim().toUpperCase())).limit(1);
  return row ?? null;
}

export async function getLetterByToken(token: string): Promise<Letter | null> {
  if (!/^[\w-]{16,64}$/.test(token)) return null;
  const [row] = await db.select().from(letter).where(eq(letter.token, token)).limit(1);
  return row ?? null;
}

export async function isCohost(l: Letter, memberId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: letterCohost.id })
    .from(letterCohost)
    .where(and(eq(letterCohost.letterId, l.id), eq(letterCohost.memberId, memberId)))
    .limit(1);
  return !!row;
}

const giftCount = sql<number>`(select count(*)::int from ${letterGift} where ${letterGift.letterId} = ${letter.id})`;

/** Jeux › Ma lettre au Père Noël: the letters a member organizes, alone or with others. */
export async function listForMember(memberId: string) {
  const cohosted = db.select({ letterId: letterCohost.letterId }).from(letterCohost).where(eq(letterCohost.memberId, memberId));
  const rows = await db
    .select({
      id: letter.id,
      code: letter.code,
      childName: letter.childName,
      year: letter.year,
      hostMemberId: letter.hostMemberId,
      sharedAt: letter.sharedAt,
      closedAt: letter.closedAt,
      gifts: giftCount,
      given: sql<number>`(select count(distinct ${letterOffer.giftId})::int from ${letterOffer} where ${letterOffer.letterId} = ${letter.id})`,
    })
    .from(letter)
    .where(or(eq(letter.hostMemberId, memberId), inArray(letter.id, cohosted)))
    .orderBy(desc(letter.year), desc(letter.createdAt));
  return rows.map((r) => ({ ...r, title: titleOf(r), stage: stageOf(r), role: r.hostMemberId === memberId ? ("host" as const) : ("cohost" as const) }));
}

/** The club's other letters: that they exist, who organizes them and where they stand. No code, no link, no list. */
export async function listOthers(memberId: string) {
  const cohosted = db.select({ letterId: letterCohost.letterId }).from(letterCohost).where(eq(letterCohost.memberId, memberId));
  const rows = await db
    .select({
      id: letter.id,
      childName: letter.childName,
      year: letter.year,
      sharedAt: letter.sharedAt,
      closedAt: letter.closedAt,
      organizer: user.name,
      gifts: giftCount,
    })
    .from(letter)
    .innerJoin(member, eq(member.id, letter.hostMemberId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(ne(letter.hostMemberId, memberId), notInArray(letter.id, cohosted)))
    .orderBy(desc(letter.createdAt))
    .limit(30);
  return rows.map((r) => ({ ...r, title: titleOf(r), stage: stageOf(r) }));
}

const loadGifts = (letterId: string) => db.select().from(letterGift).where(eq(letterGift.letterId, letterId));
const loadOffers = (letterId: string) => db.select().from(letterOffer).where(eq(letterOffer.letterId, letterId)).orderBy(asc(letterOffer.createdAt));

/** The list as each side sees it: the organizers get every amount, the family only their own. */
function giftViews(l: Letter, gifts: LetterGift[], offers: LetterOffer[], viewer: { organizer: true } | { organizer: false; visitorKey: string | null }): GiftView[] {
  return [...gifts].sort(byWish).map((g) => {
    const own = offers.filter((o) => o.giftId === g.id);
    const progress = progressOf(g, own);
    return {
      id: g.id,
      title: g.title,
      url: g.url,
      priceCents: g.priceCents,
      note: g.note,
      secondHand: g.secondHand,
      favorite: g.favorite,
      copies: g.copies,
      pot: g.pot,
      photo: imageUrl(l.token, g.photoId),
      offers: own.map((o) => {
        const mine = !viewer.organizer && viewer.visitorKey !== null && o.visitorKey === viewer.visitorKey;
        const sees = viewer.organizer || mine;
        return { id: o.id, name: o.name, amountCents: sees ? o.amountCents : null, received: sees && !!o.receivedAt, mine };
      }),
      totalCents: progress.kind === "pot" ? progress.totalCents : 0,
      full: progress.full,
    };
  });
}

export async function getOrgView(l: Letter): Promise<OrgView> {
  const [gifts, offers, cohosts, previous] = await Promise.all([
    loadGifts(l.id),
    loadOffers(l.id),
    db
      .select({ memberId: letterCohost.memberId, name: user.name })
      .from(letterCohost)
      .innerJoin(member, eq(member.id, letterCohost.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(letterCohost.letterId, l.id))
      .orderBy(asc(letterCohost.createdAt)),
    l.previousLetterId ? db.select({ childName: letter.childName, year: letter.year }).from(letter).where(eq(letter.id, l.previousLetterId)).limit(1) : Promise.resolve([]),
  ]);
  return {
    code: l.code,
    link: familyLink(l.token),
    title: titleOf(l),
    childName: l.childName,
    year: l.year,
    words: l.words,
    advice: l.advice,
    payNote: l.payNote,
    photo: imageUrl(l.token, l.photoId),
    thanksText: l.thanksText,
    thanksPhoto: imageUrl(l.token, l.thanksPhotoId),
    thanksPublished: !!l.thanksAt,
    stage: stageOf(l),
    hasCohostPassword: !!l.cohostPassword,
    cohosts,
    previousTitle: previous[0] ? titleOf(previous[0]) : null,
    gifts: giftViews(l, gifts, offers, { organizer: true }),
  };
}

export async function getFamilyView(l: Letter, visitorKey: string | null, preview: boolean): Promise<FamilyView> {
  const [gifts, offers] = await Promise.all([loadGifts(l.id), loadOffers(l.id)]);
  const mine = visitorKey ? offers.filter((o) => o.visitorKey === visitorKey) : [];
  return {
    letterId: l.id,
    title: titleOf(l),
    childName: l.childName,
    words: l.words,
    advice: l.advice,
    payNote: l.payNote,
    photo: imageUrl(l.token, l.photoId),
    thanks: l.thanksAt ? { text: l.thanksText, photo: imageUrl(l.token, l.thanksPhotoId) } : null,
    stage: stageOf(l),
    preview,
    gifts: giftViews(l, gifts, offers, { organizer: false, visitorKey }),
    myName: mine.at(-1)?.name ?? null,
  };
}

// ───────── Organizing ─────────

export async function createLetter(hostMemberId: string, childName: string, year: number): Promise<Letter> {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const [row] = await db.insert(letter).values({ code, token: newToken(), hostMemberId, childName, year }).onConflictDoNothing().returning();
    if (row) return row;
  }
}

export async function updateLetter(l: Letter, s: { childName: string; year: number; words: string; advice: string; payNote: string }): Promise<Result> {
  await db.update(letter).set(s).where(eq(letter.id, l.id));
  return { ok: true };
}

/** The child's photo, or the one of the thank-you; null takes it away. */
export async function setPhoto(l: Letter, which: "child" | "thanks", input: Buffer | null): Promise<Result> {
  const old = which === "child" ? l.photoId : l.thanksPhotoId;
  let id: string | null = null;
  if (input) {
    id = await storeImage(l.id, input);
    if (!id) return fail(BAD_PICTURE);
  }
  await db
    .update(letter)
    .set(which === "child" ? { photoId: id } : { thanksPhotoId: id })
    .where(eq(letter.id, l.id));
  await deleteImage(old);
  return { ok: true };
}

export interface GiftInput {
  title: string;
  url: string | null;
  priceCents: number | null;
  note: string;
  secondHand: boolean;
  favorite: boolean;
  copies: number | null;
  pot: boolean;
}

/** `stored`: a picture already fetched from the gift's link (see previewLink). */
export type PhotoChange = { kind: "keep" } | { kind: "remove" } | { kind: "data"; data: Buffer } | { kind: "stored"; id: string };

/** The picture a gift ends up with: undefined keeps the one it has. */
async function photoFor(l: Letter, change: PhotoChange): Promise<{ id: string | null } | { error: string } | undefined> {
  switch (change.kind) {
    case "keep":
      return undefined;
    case "remove":
      return { id: null };
    case "data": {
      const id = await storeImage(l.id, change.data);
      return id ? { id } : { error: BAD_PICTURE };
    }
    case "stored":
      return (await imageBelongs(change.id, l.id)) ? { id: change.id } : { error: "Cette photo n'est plus disponible : ajoute-la à nouveau." };
  }
}

const giftError = (input: GiftInput) => (input.pot && !input.priceCents ? "Pour une cagnotte, indique le montant à atteindre : le prix du cadeau." : null);

export async function addGift(l: Letter, input: GiftInput, photo: PhotoChange): Promise<Result> {
  const error = giftError(input);
  if (error) return fail(error);
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(letterGift).where(eq(letterGift.letterId, l.id));
  if ((row?.n ?? 0) >= LIMITS.gifts) return fail(`Une lettre tient ${LIMITS.gifts} cadeaux au plus.`);
  const picture = await photoFor(l, photo);
  if (picture && "error" in picture) return fail(picture.error);
  await db.insert(letterGift).values({ letterId: l.id, ...input, photoId: picture?.id ?? null });
  return { ok: true };
}

export async function updateGift(l: Letter, giftId: string, input: GiftInput, photo: PhotoChange): Promise<Result> {
  const [gift] = await db
    .select()
    .from(letterGift)
    .where(and(eq(letterGift.id, giftId), eq(letterGift.letterId, l.id)))
    .limit(1);
  if (!gift) return fail("Ce cadeau n'est plus sur la liste.");
  const error = giftError(input);
  if (error) return fail(error);
  if (gift.pot !== input.pot) {
    // Promises of money and gifts can't be turned into one another.
    const [offer] = await db.select({ id: letterOffer.id }).from(letterOffer).where(eq(letterOffer.giftId, gift.id)).limit(1);
    if (offer) return fail(gift.pot ? "Des parts ont déjà été promises : retire-les avant d'en faire un cadeau simple." : "Ce cadeau est déjà réservé : libère-le avant d'en faire une cagnotte.");
  }
  const picture = await photoFor(l, photo);
  if (picture && "error" in picture) return fail(picture.error);
  await db
    .update(letterGift)
    .set({ ...input, ...(picture ? { photoId: picture.id } : {}) })
    .where(eq(letterGift.id, gift.id));
  if (picture && gift.photoId && gift.photoId !== picture.id) await deleteImage(gift.photoId);
  return { ok: true };
}

export async function removeGift(l: Letter, giftId: string): Promise<Result> {
  const [gift] = await db
    .delete(letterGift)
    .where(and(eq(letterGift.id, giftId), eq(letterGift.letterId, l.id)))
    .returning({ photoId: letterGift.photoId });
  if (gift) await deleteImage(gift.photoId);
  return { ok: true };
}

/** A shop's page pasted on a gift: its name, its price, and its picture, fetched and kept for the gift to take. */
export async function previewLink(l: Letter, meta: { title: string | null; image: string | null; priceCents: number | null }): Promise<{ title: string | null; priceCents: number | null; photo: { id: string; url: string } | null }> {
  await deleteOrphanImages(l.id);
  let photo: { id: string; url: string } | null = null;
  if (meta.image) {
    const data = await downloadImage(meta.image);
    const id = data ? await storeImage(l.id, data) : null;
    const url = imageUrl(l.token, id);
    if (id && url) photo = { id, url };
  }
  return { title: meta.title, priceCents: meta.priceCents, photo };
}

export async function shareLetter(l: Letter): Promise<Result> {
  if (l.sharedAt) return { ok: true };
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(letterGift).where(eq(letterGift.letterId, l.id));
  if (!row?.n) return fail("Ajoute au moins un cadeau avant d'envoyer la lettre.");
  await db.update(letter).set({ sharedAt: new Date() }).where(eq(letter.id, l.id));
  return { ok: true };
}

export async function setClosed(l: Letter, closed: boolean): Promise<Result> {
  if (!l.sharedAt) return fail("La lettre n'est pas encore envoyée.");
  await db
    .update(letter)
    .set({ closedAt: closed ? (l.closedAt ?? new Date()) : null })
    .where(eq(letter.id, l.id));
  return { ok: true };
}

/** « Le merci » of the child after Christmas: saved, and shown to the family once published. */
export async function saveThanks(l: Letter, text: string, publish: boolean): Promise<Result> {
  if (publish && !text.trim() && !l.thanksPhotoId) return fail("Écris quelques mots ou ajoute une photo avant de publier le merci.");
  await db
    .update(letter)
    .set({ thanksText: text, thanksAt: publish ? (l.thanksAt ?? new Date()) : null })
    .where(eq(letter.id, l.id));
  return { ok: true };
}

/**
 * Someone gives a gift or promises part of a cagnotte. The gift's row is locked meanwhile: two people
 * tapping the last one at the same moment can't both have it, and a cagnotte never goes past its amount.
 */
async function placeOffer(
  l: Letter,
  giftId: string,
  name: string,
  amountCents: number | null,
  visitorKey: string | null,
): Promise<{ ok: true; giftTitle: string; amountCents: number | null; totalCents?: number; targetCents?: number } | { ok: false; error: string }> {
  return db.transaction(async (tx) => {
    const [gift] = await tx
      .select()
      .from(letterGift)
      .where(and(eq(letterGift.id, giftId), eq(letterGift.letterId, l.id)))
      .for("update");
    if (!gift) return fail("Ce cadeau n'est plus sur la liste.");
    const offers = await tx.select({ name: letterOffer.name, amountCents: letterOffer.amountCents }).from(letterOffer).where(eq(letterOffer.giftId, gift.id));
    const progress = progressOf(gift, offers);
    if (progress.kind === "pot") {
      const error = pledgeError(amountCents, progress.remainingCents);
      if (error) return fail(error);
    } else if (progress.full) {
      const by = offers.map((o) => o.name).join(", ");
      return fail(gift.copies === 1 ? `${by} vient de le réserver. La liste est à jour.` : "Il vient d'être réservé autant de fois que possible. La liste est à jour.");
    }
    const amount = gift.pot ? amountCents : null;
    await tx.insert(letterOffer).values({ letterId: l.id, giftId: gift.id, name, visitorKey, amountCents: amount });
    return progress.kind === "pot"
      ? { ok: true as const, giftTitle: gift.title, amountCents: amount, totalCents: progress.totalCents + (amount ?? 0), targetCents: progress.targetCents }
      : { ok: true as const, giftTitle: gift.title, amountCents: null };
  });
}

/** An organizer notes a gift or a part for someone (who told them on the phone, say). */
export async function noteOffer(l: Letter, giftId: string, name: string, amountCents: number | null, actorMemberId: string): Promise<Result> {
  const who = cleanName(name);
  if (!who) return fail("Il manque le prénom de la personne.");
  const placed = await placeOffer(l, giftId, who, amountCents, null);
  if (!placed.ok) return placed;
  await notifyOrganizers(l, actorMemberId, { type: "offer", name: who, ...placed });
  return { ok: true };
}

export async function removeOffer(l: Letter, offerId: string, actorMemberId: string): Promise<Result> {
  const [gone] = await db
    .delete(letterOffer)
    .where(and(eq(letterOffer.id, offerId), eq(letterOffer.letterId, l.id)))
    .returning();
  if (!gone) return { ok: true };
  const [gift] = await db.select({ title: letterGift.title }).from(letterGift).where(eq(letterGift.id, gone.giftId)).limit(1);
  await notifyOrganizers(l, actorMemberId, { type: "withdraw", name: gone.name, giftTitle: gift?.title ?? "?", amountCents: gone.amountCents });
  return { ok: true };
}

export async function setReceived(l: Letter, offerId: string, received: boolean): Promise<Result> {
  await db
    .update(letterOffer)
    .set({ receivedAt: received ? new Date() : null })
    .where(and(eq(letterOffer.id, offerId), eq(letterOffer.letterId, l.id)));
  return { ok: true };
}

export async function addCohost(l: Letter, memberId: string): Promise<Result> {
  if (memberId === l.hostMemberId) return fail("Tu organises déjà cette lettre.");
  await db.insert(letterCohost).values({ letterId: l.id, memberId }).onConflictDoNothing();
  return { ok: true };
}

export async function removeCohost(l: Letter, memberId: string): Promise<Result> {
  await db.delete(letterCohost).where(and(eq(letterCohost.letterId, l.id), eq(letterCohost.memberId, memberId)));
  return { ok: true };
}

export async function setCohostPassword(l: Letter, password: string | null): Promise<Result> {
  if (password !== null && password.trim().length < 4) return fail("Le mot de passe doit faire au moins 4 caractères.");
  await db
    .update(letter)
    .set({ cohostPassword: password === null ? null : hashPassword(password) })
    .where(eq(letter.id, l.id));
  return { ok: true };
}

/** A member types the co-organization password and joins. */
export async function joinOrganization(l: Letter, memberId: string, password: string): Promise<Result> {
  if (memberId === l.hostMemberId) return { ok: true };
  if (!l.cohostPassword) return fail("Cette lettre n'a pas de mot de passe de co-organisation : demande à son organisateur de t'ajouter.");
  if (!verifyPassword(password, l.cohostPassword)) return fail("Ce n'est pas le bon mot de passe.");
  await db.insert(letterCohost).values({ letterId: l.id, memberId }).onConflictDoNothing();
  return { ok: true };
}

/**
 * Next year's letter: same child, photo, advice, word for the cagnotte, organization and password; a
 * blank page for the child's words. With `carry`, the gifts nobody gave come along.
 */
export async function duplicateLetter(l: Letter, memberId: string, carry: boolean): Promise<Letter> {
  const next = await createLetter(memberId, l.childName, l.year + 1);
  const photoId = await copyImage(l.photoId, next.id);
  await db
    .update(letter)
    .set({ advice: l.advice, payNote: l.payNote, cohostPassword: l.cohostPassword, previousLetterId: l.id, photoId })
    .where(eq(letter.id, next.id));
  if (carry) {
    const [gifts, offers] = await Promise.all([loadGifts(l.id), loadOffers(l.id)]);
    for (const g of untaken(gifts, offers).sort(byWish)) {
      await db.insert(letterGift).values({
        letterId: next.id,
        title: g.title,
        url: g.url,
        priceCents: g.priceCents,
        note: g.note,
        secondHand: g.secondHand,
        favorite: g.favorite,
        copies: g.copies,
        pot: g.pot,
        photoId: await copyImage(g.photoId, next.id),
      });
    }
  }
  const cohosts = await db.select({ memberId: letterCohost.memberId }).from(letterCohost).where(eq(letterCohost.letterId, l.id));
  const team = [...cohosts.map((c) => c.memberId), l.hostMemberId].filter((id) => id !== memberId);
  for (const id of team) await db.insert(letterCohost).values({ letterId: next.id, memberId: id }).onConflictDoNothing();
  return next;
}

/** How many gifts nobody gave: what « Dupliquer » offers to bring along. */
export async function untakenCount(l: Letter): Promise<number> {
  const [gifts, offers] = await Promise.all([loadGifts(l.id), loadOffers(l.id)]);
  return untaken(gifts, offers).length;
}

export async function deleteLetter(l: Letter): Promise<void> {
  await db.delete(letter).where(eq(letter.id, l.id));
}

// ───────── The family's page ─────────

/** Someone of the family gives a gift, or promises part of a cagnotte, from the letter's link. */
export async function offerFromFamily(token: string, visitorKey: string, giftId: string, name: string, amountCents: number | null): Promise<Result> {
  const l = await getLetterByToken(token);
  if (!l) return fail("Ce lien ne mène nulle part.");
  if (!l.sharedAt) return fail("Cette lettre n'est pas encore envoyée : on ne peut pas encore réserver.");
  if (l.closedAt) return fail("Les réservations sont fermées.");
  const who = cleanName(name);
  if (!who) return fail("Indiquez votre prénom : c'est ce que verront les autres.");
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(letterOffer)
    .where(and(eq(letterOffer.letterId, l.id), eq(letterOffer.visitorKey, visitorKey)));
  if ((row?.n ?? 0) >= LIMITS.offersPerVisitor) return fail("Vous avez déjà beaucoup réservé sur cette lettre !");
  const placed = await placeOffer(l, giftId, who, amountCents, visitorKey);
  if (!placed.ok) return placed;
  await notifyOrganizers(l, null, { type: "offer", name: who, ...placed });
  return { ok: true };
}

/** The person who gave or promised takes it back, from the same browser. */
export async function withdrawFromFamily(token: string, visitorKey: string, offerId: string): Promise<Result> {
  const l = await getLetterByToken(token);
  if (!l) return fail("Ce lien ne mène nulle part.");
  if (l.closedAt) return fail("Les réservations sont fermées : voyez directement avec la personne qui vous a envoyé la lettre.");
  const [offer] = await db
    .select()
    .from(letterOffer)
    .where(and(eq(letterOffer.id, offerId), eq(letterOffer.letterId, l.id), eq(letterOffer.visitorKey, visitorKey)))
    .limit(1);
  if (!offer) return fail("Cette réservation n'a pas été faite depuis ce téléphone : demandez à la personne qui vous a envoyé la lettre.");
  if (offer.receivedAt) return fail("Votre part a déjà été reçue : voyez directement avec la personne qui vous a envoyé la lettre.");
  await db.delete(letterOffer).where(eq(letterOffer.id, offer.id));
  const [gift] = await db.select({ title: letterGift.title }).from(letterGift).where(eq(letterGift.id, offer.giftId)).limit(1);
  await notifyOrganizers(l, null, { type: "withdraw", name: offer.name, giftTitle: gift?.title ?? "?", amountCents: offer.amountCents });
  return { ok: true };
}
