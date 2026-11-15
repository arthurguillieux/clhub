import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, customType, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { member } from "./member";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * « Ma lettre au Père Noël » (jeux/lettre): a child's wish list for the family, one per child and
 * per year. Its organizers — a member, plus the co-organizers they add or let in with a password —
 * fill it in; the family opens it through a single secret link, no account needed, and says what
 * they give. Nothing here handles money: a « cagnotte » only records promises, and the organizers
 * tick them off once the money has come, by Wero or otherwise.
 *
 * `sharedAt` null: still in preparation, only the organizers see the family's page. `closedAt`:
 * nothing more can be reserved (Christmas is over). `thanksAt`: the child's thank-you is out.
 */
export const letter = pgTable("letter", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  /** The secret in the family's link. */
  token: text("token").notNull().unique(),
  hostMemberId: uuid("host_member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  childName: text("child_name").notNull(),
  year: integer("year").notNull(),
  /** What the child tells Santa, written down with them. */
  words: text("words").notNull().default(""),
  /** « Bon à savoir », the organizers' word to everyone, like « l'occasion est bienvenue ». */
  advice: text("advice").notNull().default(""),
  /** How to send one's part of a cagnotte, like « par Wero au 06… ». */
  payNote: text("pay_note").notNull().default(""),
  photoId: uuid("photo_id").references((): AnyPgColumn => letterImage.id, { onDelete: "set null" }),
  thanksText: text("thanks_text").notNull().default(""),
  thanksPhotoId: uuid("thanks_photo_id").references((): AnyPgColumn => letterImage.id, { onDelete: "set null" }),
  thanksAt: timestamp("thanks_at", { withTimezone: true }),
  /** As on a Secret Santa: a club member who knows it joins the organization. Salted scrypt hash, see core/auth/sharedPassword. */
  cohostPassword: text("cohost_password"),
  /** Last year's letter, when this one was duplicated from it. */
  previousLetterId: uuid("previous_letter_id").references((): AnyPgColumn => letter.id, { onDelete: "set null" }),
  sharedAt: timestamp("shared_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const letterCohost = pgTable(
  "letter_cohost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    letterId: uuid("letter_id")
      .notNull()
      .references(() => letter.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("letter_cohost_letter_member_idx").on(t.letterId, t.memberId)],
);

/**
 * The pictures of a letter (the child, the gifts, the thank-you), as webp. In the database rather
 * than under public/uploads: they're only served to whoever has the family's link.
 */
export const letterImage = pgTable(
  "letter_image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    letterId: uuid("letter_id")
      .notNull()
      .references((): AnyPgColumn => letter.id, { onDelete: "cascade" }),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("letter_image_letter_idx").on(t.letterId)],
);

/** One wish on the list. `url` is only an example of where to find it: people buy it wherever they like. */
export const letterGift = pgTable(
  "letter_gift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    letterId: uuid("letter_id")
      .notNull()
      .references(() => letter.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    /** Indicative; for a cagnotte, the amount to reach. */
    priceCents: integer("price_cents"),
    note: text("note").notNull().default(""),
    secondHand: boolean("second_hand").notNull().default(false),
    /** One of the child's favourites: first on the list. */
    favorite: boolean("favorite").notNull().default(false),
    /** How many people can give it: 1 as a rule, null for as many as want to (books, Lego...). Unused for a cagnotte. */
    copies: integer("copies").default(1),
    /** A cagnotte: everyone promises part of the price, and a gauge fills up to it. */
    pot: boolean("pot").notNull().default(false),
    photoId: uuid("photo_id").references(() => letterImage.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("letter_gift_letter_idx").on(t.letterId)],
);

/**
 * Someone gives a gift, or promises part of a cagnotte (`amountCents`). `visitorKey` is the random
 * key in the cookie of the browser it came from, so that person can take it back; null when an
 * organizer noted it for someone. `receivedAt`: the organizers have the money.
 */
export const letterOffer = pgTable(
  "letter_offer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    letterId: uuid("letter_id")
      .notNull()
      .references(() => letter.id, { onDelete: "cascade" }),
    giftId: uuid("gift_id")
      .notNull()
      .references(() => letterGift.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    visitorKey: text("visitor_key"),
    amountCents: integer("amount_cents"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("letter_offer_gift_idx").on(t.giftId), index("letter_offer_letter_idx").on(t.letterId)],
);

export type Letter = typeof letter.$inferSelect;
export type LetterGift = typeof letterGift.$inferSelect;
export type LetterOffer = typeof letterOffer.$inferSelect;
