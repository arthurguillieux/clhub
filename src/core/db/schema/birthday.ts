import { date, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * « Un anniversaire » (Célébrer): a few members club together for someone's present, behind their
 * back. The person celebrated is either a member (`honoreeMemberId`, who must never see any of it:
 * no page, no feed, no notification, even in admin mode) or just a first name (`honoreeName` always
 * holds the name shown). Only the participants see the birthday; nothing here is logged to the
 * club's activity feed.
 *
 * Its life: ideas and thumbs up → the creator decides (`chosenIdeaId`) → someone takes charge
 * (`buyerMemberId`) → they enter the real price (`priceCents`, `boughtAt`) → the price is split in
 * equal parts between those who said « je participe », each ticks « J'ai remboursé ».
 */
export const birthday = pgTable(
  "birthday",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    honoreeMemberId: uuid("honoree_member_id").references(() => member.id, { onDelete: "set null" }),
    honoreeName: text("honoree_name").notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    /** The creator's word to the others (« budget autour de 20 € chacun »). */
    note: text("note").notNull().default(""),
    /** No foreign key, to keep the two tables simple to create; the idea's deletion clears it in code. */
    chosenIdeaId: uuid("chosen_idea_id"),
    buyerMemberId: uuid("buyer_member_id").references(() => member.id, { onDelete: "set null" }),
    priceCents: integer("price_cents"),
    boughtAt: timestamp("bought_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("birthday_honoree_idx").on(t.honoreeMemberId)],
);

/** Who is in on it. `answer`: « pending » until they say « yes » (je participe) or « no ». */
export const birthdayParticipant = pgTable(
  "birthday_participant",
  {
    birthdayId: uuid("birthday_id")
      .notNull()
      .references(() => birthday.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    answer: text("answer").notNull().default("pending"),
    invitedById: uuid("invited_by_id").references(() => member.id, { onDelete: "set null" }),
    repaidAt: timestamp("repaid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.birthdayId, t.memberId] }), index("birthday_participant_member_idx").on(t.memberId)],
);

export const birthdayIdea = pgTable(
  "birthday_idea",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    birthdayId: uuid("birthday_id")
      .notNull()
      .references(() => birthday.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    priceCents: integer("price_cents"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("birthday_idea_birthday_idx").on(t.birthdayId)],
);

/** A thumb up: one per member and idea; a member can like several ideas. */
export const birthdayVote = pgTable(
  "birthday_vote",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => birthdayIdea.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.memberId] })],
);

export type Birthday = typeof birthday.$inferSelect;
export type BirthdayIdea = typeof birthdayIdea.$inferSelect;
