/**
 * Integration test — needs a live Postgres with migrations applied (DATABASE_URL).
 * The family comes with nothing but a link and a cookie, so who may take what, and when, is checked
 * against the real tables: the last gift tapped twice at once, a cagnotte that must not go past its
 * amount, a promise only its author can take back.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/core/db/client";
import { letter, letterGift, member, notification, user, type Letter } from "@/core/db/schema";
import { countImages, readImage } from "./images";
import {
  addCohost,
  addGift,
  createLetter,
  duplicateLetter,
  getFamilyView,
  getLetterByCode,
  getOrgView,
  listForMember,
  noteOffer,
  offerFromFamily,
  removeOffer,
  setClosed,
  setPhoto,
  setReceived,
  shareLetter,
  updateLetter,
  withdrawFromFamily,
  type GiftInput,
} from "./letters";

const gift = (title: string, more: Partial<GiftInput> = {}): GiftInput => ({
  title,
  url: null,
  priceCents: null,
  note: "",
  secondHand: false,
  favorite: false,
  copies: 1,
  pot: false,
  ...more,
});

describe("Ma lettre au Père Noël", () => {
  const userIds = [randomUUID(), randomUUID()];
  let hostId: string;
  let cohostId: string;
  let l: Letter;
  let bike: string;
  let draisienne: string;
  let books: string;
  const fresh = async () => (await getLetterByCode(l.code))!;
  const giftId = async (title: string) => (await getOrgView(await fresh())).gifts.find((g) => g.title === title)!.id;

  beforeAll(async () => {
    for (const id of userIds) await db.insert(user).values({ id, email: `test-${id}@example.com`, name: `Test ${id.slice(0, 4)}`, emailVerified: true });
    hostId = (await db.insert(member).values({ userId: userIds[0]! }).returning())[0]!.id;
    cohostId = (await db.insert(member).values({ userId: userIds[1]! }).returning())[0]!.id;
    l = await createLetter(hostId, "Arès", 2026);
    await addCohost(l, cohostId);
    await updateLetter(l, { childName: "Arès", year: 2026, words: "Cher Père Noël", advice: "Occasion bienvenue", payNote: "Par Wero" });
  });

  afterAll(async () => {
    await db.delete(letter).where(inArray(letter.hostMemberId, [hostId, cohostId]));
    await db.delete(notification).where(inArray(notification.memberId, [hostId, cohostId]));
    await db.delete(member).where(inArray(member.id, [hostId, cohostId]));
    await db.delete(user).where(inArray(user.id, userIds));
  });

  it("can't be sent empty, and nobody reserves before it's sent", async () => {
    expect(await shareLetter(l)).toEqual({ ok: false, error: "Ajoute au moins un cadeau avant d'envoyer la lettre." });
    expect((await addGift(l, gift("Draisienne", { favorite: true, priceCents: 5990 }), { kind: "keep" })).ok).toBe(true);
    expect((await addGift(l, gift("Des livres", { copies: 2 }), { kind: "keep" })).ok).toBe(true);
    expect(await addGift(l, gift("Vélo", { pot: true }), { kind: "keep" })).toEqual({ ok: false, error: "Pour une cagnotte, indique le montant à atteindre : le prix du cadeau." });
    expect((await addGift(l, gift("Vélo", { pot: true, priceCents: 20000 }), { kind: "keep" })).ok).toBe(true);
    draisienne = await giftId("Draisienne");
    books = await giftId("Des livres");
    bike = await giftId("Vélo");
    expect(await offerFromFamily(l.token, "visitor-key-claire-0000000", draisienne, "Claire", null)).toEqual({
      ok: false,
      error: "Cette lettre n'est pas encore envoyée : on ne peut pas encore réserver.",
    });
    expect((await shareLetter(l)).ok).toBe(true);
  });

  it("gives the last gift to one person only, even tapped twice at the same moment", async () => {
    const results = await Promise.all([
      offerFromFamily(l.token, "visitor-key-claire-0000000", draisienne, "Claire", null),
      offerFromFamily(l.token, "visitor-key-thomas-0000000", draisienne, "Thomas", null),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, error: expect.stringMatching(/vient de le réserver/) });
  });

  it("lets as many people as allowed give a gift several can give", async () => {
    expect((await offerFromFamily(l.token, "visitor-key-claire-0000000", books, "Claire", null)).ok).toBe(true);
    expect((await offerFromFamily(l.token, "visitor-key-sophie-0000000", books, "Sophie", null)).ok).toBe(true);
    expect(await offerFromFamily(l.token, "visitor-key-julien-0000000", books, "Julien", null)).toMatchObject({ ok: false });
  });

  it("closes a cagnotte at its amount: the last one only gives what's left", async () => {
    expect((await offerFromFamily(l.token, "visitor-key-claire-0000000", bike, "Claire", 12000)).ok).toBe(true);
    expect((await offerFromFamily(l.token, "visitor-key-thomas-0000000", bike, "Thomas", 6000)).ok).toBe(true);
    const tooMuch = await offerFromFamily(l.token, "visitor-key-sophie-0000000", bike, "Sophie", 5000);
    expect(tooMuch.ok).toBe(false);
    expect(!tooMuch.ok && tooMuch.error.replace(/\s/g, " ")).toBe("Il ne manque plus que 20 € : vous pouvez promettre ce montant au plus.");
    expect((await offerFromFamily(l.token, "visitor-key-sophie-0000000", bike, "Sophie", 2000)).ok).toBe(true);
    expect(await offerFromFamily(l.token, "visitor-key-julien-0000000", bike, "Julien", 1000)).toEqual({ ok: false, error: "La cagnotte est déjà complète. Merci !" });
  });

  it("shows the family who gives what, but no one else's amount", async () => {
    const asSophie = await getFamilyView(await fresh(), "visitor-key-sophie-0000000", false);
    const pot = asSophie.gifts.find((g) => g.id === bike)!;
    expect(pot.totalCents).toBe(20000);
    expect(pot.full).toBe(true);
    expect(pot.offers.map((o) => [o.name, o.amountCents, o.mine])).toEqual([
      ["Claire", null, false],
      ["Thomas", null, false],
      ["Sophie", 2000, true],
    ]);
    expect(asSophie.myName).toBe("Sophie");
    // The favourite comes first.
    expect(asSophie.gifts[0]!.title).toBe("Draisienne");
    const org = await getOrgView(await fresh());
    expect(org.gifts.find((g) => g.id === bike)!.offers.map((o) => o.amountCents)).toEqual([12000, 6000, 2000]);
    // Jeux › Ma lettre au Père Noël counts « déjà pris » as the letter's page does: the full cagnotte too.
    expect((await listForMember(hostId)).find((x) => x.id === l.id)).toMatchObject({ gifts: 3, taken: 3 });
  });

  it("lets only the author take a promise back, and not once the money came", async () => {
    const org = await getOrgView(await fresh());
    const claires = org.gifts.find((g) => g.id === bike)!.offers.find((o) => o.name === "Claire")!;
    const thomas = org.gifts.find((g) => g.id === bike)!.offers.find((o) => o.name === "Thomas")!;
    expect((await withdrawFromFamily(l.token, "visitor-key-sophie-0000000", claires.id)).ok).toBe(false);
    await setReceived(await fresh(), claires.id, true);
    expect(await withdrawFromFamily(l.token, "visitor-key-claire-0000000", claires.id)).toMatchObject({ ok: false, error: expect.stringMatching(/déjà été reçue/) });
    expect((await withdrawFromFamily(l.token, "visitor-key-thomas-0000000", thomas.id)).ok).toBe(true);
    const after = (await getOrgView(await fresh())).gifts.find((g) => g.id === bike)!;
    expect(after.totalCents).toBe(14000);
    expect(after.full).toBe(false);
    // A cagnotte on its way isn't « pris ».
    expect((await listForMember(hostId)).find((x) => x.id === l.id)).toMatchObject({ gifts: 3, taken: 2 });
  });

  it("lets an organizer note a gift for someone, and tells the other organizers", async () => {
    const before = await db.select().from(notification).where(eq(notification.entityRef, `lettre:${l.code}`));
    expect(before.filter((n) => n.memberId === hostId).length).toBeGreaterThan(0); // the family's offers reached the creator
    const [extra] = await db.insert(letterGift).values({ letterId: l.id, title: "Puzzle" }).returning();
    expect((await noteOffer(await fresh(), extra!.id, "  Julien  ", null, hostId)).ok).toBe(true);
    const about = await db
      .select()
      .from(notification)
      .where(and(eq(notification.entityRef, `lettre:${l.code}`), sql`${notification.payload}->>'giftTitle' = 'Puzzle'`));
    expect(about.map((n) => n.memberId)).toEqual([cohostId]);
    // The other organizer reads who noted it, so they don't think Julien did it from the link.
    const hostName = `Test ${userIds[0]!.slice(0, 4)}`;
    expect(about[0]!.payload).toMatchObject({ name: "Julien", by: hostName });
    const org = await getOrgView(await fresh());
    const puzzle = org.gifts.find((g) => g.title === "Puzzle")!;
    expect(puzzle.offers[0]!.name).toBe("Julien");
    expect((await removeOffer(await fresh(), puzzle.offers[0]!.id, cohostId)).ok).toBe(true);
    const [freed] = await db
      .select()
      .from(notification)
      .where(and(eq(notification.memberId, hostId), eq(notification.kind, "lettre.withdraw"), sql`${notification.payload}->>'giftTitle' = 'Puzzle'`));
    expect(freed?.payload).toMatchObject({ name: "Julien", by: `Test ${userIds[1]!.slice(0, 4)}` });
  });

  it("refuses anything new once closed", async () => {
    expect((await setClosed(await fresh(), true)).ok).toBe(true);
    expect(await offerFromFamily(l.token, "visitor-key-julien-0000000", bike, "Julien", 1000)).toEqual({ ok: false, error: "Les réservations sont fermées." });
    expect((await setClosed(await fresh(), false)).ok).toBe(true);
  });

  it("keeps its pictures behind the link", async () => {
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#b4233a" } })
      .png()
      .toBuffer();
    expect((await setPhoto(await fresh(), "child", png)).ok).toBe(true);
    expect(await setPhoto(await fresh(), "child", Buffer.from("not a picture"))).toEqual({ ok: false, error: "Cette image ne s'ouvre pas : essaie une photo en JPEG ou en PNG." });
    const photoId = (await fresh()).photoId!;
    const stored = await readImage(l.token, photoId);
    expect(stored && (await sharp(stored).metadata()).format).toBe("webp");
    expect(await readImage("someone-elses-token-000000", photoId)).toBeNull();
  });

  it("starts next year's letter from this one, with the gifts nobody gave", async () => {
    const current = await fresh();
    // Only the puzzle comes along: the others were given, or have parts promised.
    const next = await duplicateLetter(current, cohostId, true);
    expect(next.year).toBe(2027);
    const org = await getOrgView((await getLetterByCode(next.code))!);
    expect(org.title).toBe("Lettre au Père Noël d'Arès 2027");
    expect(org.words).toBe("");
    expect(org.advice).toBe("Occasion bienvenue");
    expect(org.stage).toBe("preparation");
    expect(org.gifts.map((g) => g.title)).toEqual(["Puzzle"]);
    expect(org.photo).not.toBeNull();
    expect(org.cohosts.map((c) => c.memberId)).toEqual([hostId]);
    expect(org.previousTitle).toBe("Lettre au Père Noël d'Arès 2026");
    expect(await countImages([next.id])).toBe(1);
  });
});
