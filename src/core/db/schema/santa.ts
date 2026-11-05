import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
  previousEventId: uuid("previous_event_id").references((): AnyPgColumn => santaEvent.id, { onDelete: "set null" }),
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

export type SantaEvent = typeof santaEvent.$inferSelect;
export type SantaParticipant = typeof santaParticipant.$inferSelect;
