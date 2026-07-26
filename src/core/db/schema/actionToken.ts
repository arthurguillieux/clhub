import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * A one-click, no-login action authorized from an email link — e.g. approve
 * or reject a booking request. The action is fixed at creation time (see
 * ADR-013-style reasoning for invitations): the token can only ever perform
 * the single action it was minted for, never one chosen by a query param at
 * click time.
 */
export const actionToken = pgTable("action_token", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id),
  action: text("action").notNull(), // e.g. 'booking.approve' | 'booking.reject'
  payload: jsonb("payload").notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ActionToken = typeof actionToken.$inferSelect;
export type NewActionToken = typeof actionToken.$inferInsert;
