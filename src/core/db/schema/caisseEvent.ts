import { pgTable, uuid, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "Caisse commune", façon Tricount (docs/03-roadmap.md) — personne n'avance
 * dans un pot commun : chacun paie ce qu'il paie pour un évènement donné
 * (un weekend, un camping), et on calcule ensuite qui doit quoi à qui. La
 * répartition se fait en "parts" plutôt qu'en têtes, pour qu'un profil
 * partagé comme "Marine et Arthur" compte pour deux — voir
 * member.householdSize et modules/caisse/domain/settlement.ts.
 */
export const expenseEvent = pgTable("expense_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => member.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventParticipant = pgTable(
  "event_participant",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => expenseEvent.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    // Pre-filled from member.householdSize at the time they're added,
    // but stored per-event — Arthur alone at a camping trip is 1 part
    // there even though the shared profile is normally 2.
    shares: integer("shares").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.memberId] })],
);

export const expense = pgTable("expense", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => expenseEvent.id),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  // Who actually paid vs. who logged it — two different members, so
  // recording a purchase on someone else's behalf doesn't misattribute
  // who's owed the money.
  paidByMemberId: uuid("paid_by_member_id")
    .notNull()
    .references(() => member.id),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => member.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** An actual reimbursement between two members, recorded to net out the suggested transfers. */
export const settlementPayment = pgTable("settlement_payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => expenseEvent.id),
  fromMemberId: uuid("from_member_id")
    .notNull()
    .references(() => member.id),
  toMemberId: uuid("to_member_id")
    .notNull()
    .references(() => member.id),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExpenseEvent = typeof expenseEvent.$inferSelect;
export type NewExpenseEvent = typeof expenseEvent.$inferInsert;
export type EventParticipant = typeof eventParticipant.$inferSelect;
export type Expense = typeof expense.$inferSelect;
export type NewExpense = typeof expense.$inferInsert;
export type SettlementPayment = typeof settlementPayment.$inferSelect;
export type NewSettlementPayment = typeof settlementPayment.$inferInsert;
