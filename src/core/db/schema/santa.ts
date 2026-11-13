import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * Secret Santa (jeux/santa). A member organizes it, alone or with co-organizers: participants —
 * club members or anyone with an email — exclusion rules, then the draw and the mails. Each
 * participant discovers who they give to on a personal page reached through a secret link, no
 * account needed.
 *
 * Status: 'preparation' (organizers edit everything) → 'launched' (drawn, mails sent). A launched
 * event can be filed away (`archivedAt`) and brought back; `previousEventId` is last year's event,
 * whose draw the new one avoids repeating. Deleting the organizer takes their events with them.
 */
export const santaEvent = pgTable("santa_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  hostMemberId: uuid("host_member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("preparation"),
  /** Free text, so « 20 € » and « un truc fait main » both work. */
  budget: text("budget").notNull().default(""),
  exchangeDate: date("exchange_date", { mode: "string" }),
  /** The organizer's word, shown in the mail and on every personal page. */
  message: text("message").notNull().default(""),
  /** The look of its pages and mails: see modules/santa/themes.ts. */
  theme: text("theme").notNull().default("neon"),
  /** Optional, as on a Killer game: a club member who knows it joins the organization. Salted scrypt hash, see core/auth/sharedPassword. */
  cohostPassword: text("cohost_password"),
  previousEventId: uuid("previous_event_id").references((): AnyPgColumn => santaEvent.id, { onDelete: "set null" }),
  /** « 🍽️ Les repas », off unless the organizers turn it on: who's there for which meal, who brings what. */
  mealsEnabled: boolean("meals_enabled").notNull().default(false),
  mealsFrom: date("meals_from", { mode: "string" }),
  mealsTo: date("meals_to", { mode: "string" }),
  /** The organizers' word above the meals, like « whoever cooks does the shopping and the dishes ». */
  mealsNote: text("meals_note").notNull().default(""),
  launchedAt: timestamp("launched_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const santaCohost = pgTable(
  "santa_cohost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => santaEvent.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("santa_cohost_event_member_idx").on(t.eventId, t.memberId)],
);

/**
 * One participant. A club member has `memberId` (their address is read from their account when
 * mailing, so it's never copied here); anyone else has `email`. `token` is the secret of their
 * personal link. `recipientId` is who they give to: never shown to organizers, unless they unmask it.
 */
export const santaParticipant = pgTable(
  "santa_participant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => santaEvent.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => member.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    token: text("token").notNull().unique(),
    recipientId: uuid("recipient_id").references((): AnyPgColumn => santaParticipant.id, { onDelete: "set null" }),
    /** Their letter to Santa: only whoever drew them reads it. */
    letter: text("letter").notNull().default(""),
    letterNotifiedAt: timestamp("letter_notified_at", { withTimezone: true }),
    mailSentAt: timestamp("mail_sent_at", { withTimezone: true }),
    mailError: text("mail_error"),
    /** When they first opened their gift. */
    revealedAt: timestamp("revealed_at", { withTimezone: true }),
    /** For the meals: diet, allergies, intolerances, in their own words. */
    diet: text("diet").notNull().default(""),
    /** For the meals: people who come with them without taking part in the Secret Santa, like children. */
    guests: integer("guests").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("santa_participant_event_idx").on(t.eventId), index("santa_participant_member_idx").on(t.memberId)],
);

/** « `fromId` can't draw `toId` » — and the other way round too when `mutual`. */
export const santaExclusion = pgTable(
  "santa_exclusion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => santaEvent.id, { onDelete: "cascade" }),
    fromId: uuid("from_id")
      .notNull()
      .references(() => santaParticipant.id, { onDelete: "cascade" }),
    toId: uuid("to_id")
      .notNull()
      .references(() => santaParticipant.id, { onDelete: "cascade" }),
    mutual: boolean("mutual").notNull().default(true),
  },
  (t) => [uniqueIndex("santa_exclusion_pair_idx").on(t.fromId, t.toId)],
);

/** An anonymous question: the giver (`askerId`) asks the person they drew (`targetId`), who answers without knowing who asked. */
export const santaQuestion = pgTable(
  "santa_question",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => santaEvent.id, { onDelete: "cascade" }),
    askerId: uuid("asker_id")
      .notNull()
      .references(() => santaParticipant.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => santaParticipant.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [index("santa_question_event_idx").on(t.eventId)],
);

/** A trace of each time an organizer looked at the draw: the other organizers can see it. */
export const santaUnmask = pgTable("santa_unmask", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => santaEvent.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => santaParticipant.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One meal to plan: a day and « midi » or « soir ». The organizers' range of days creates them;
 * one turned off (`off`), or outside the range, is hidden, never deleted, so nothing planned is lost.
 */
export const santaMeal = pgTable(
  "santa_meal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => santaEvent.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    meal: text("meal").notNull(),
    off: boolean("off").notNull().default(false),
  },
  (t) => [uniqueIndex("santa_meal_slot_idx").on(t.eventId, t.day, t.meal)],
);

/** « I'll be there » ('x') or « maybe » ('?'); no row means no answer yet, or not there. */
export const santaPresence = pgTable(
  "santa_presence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => santaMeal.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => santaParticipant.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
  },
  (t) => [uniqueIndex("santa_presence_idx").on(t.mealId, t.participantId)],
);

/** A dish someone brings to a meal, maybe with someone else; an `idea` commits nobody until someone takes it. */
export const santaDish = pgTable(
  "santa_dish",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => santaEvent.id, { onDelete: "cascade" }),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => santaMeal.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => santaParticipant.id, { onDelete: "cascade" }),
    withId: uuid("with_id").references(() => santaParticipant.id, { onDelete: "set null" }),
    what: text("what").notNull(),
    category: text("category").notNull(),
    parts: integer("parts"),
    veg: boolean("veg").notNull().default(false),
    note: text("note").notNull().default(""),
    idea: boolean("idea").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("santa_dish_event_idx").on(t.eventId)],
);

/** Drinks for the whole stay: « 2 bouteilles de vin rouge (Bourgueil) ». */
export const santaDrink = pgTable(
  "santa_drink",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => santaEvent.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => santaParticipant.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    quantity: integer("quantity").notNull(),
    unit: text("unit").notNull(),
    what: text("what").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("santa_drink_event_idx").on(t.eventId)],
);

export type SantaEvent = typeof santaEvent.$inferSelect;
export type SantaParticipant = typeof santaParticipant.$inferSelect;
