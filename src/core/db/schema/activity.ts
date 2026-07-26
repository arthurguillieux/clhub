import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * The common feed every section writes to — what makes the club feel like one
 * platform instead of several sites glued together (see docs/01-produit.md §3).
 */
export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  section: text("section").notNull(), // 'club' | 'pretotheque' | ...
  kind: text("kind").notNull(), // e.g. 'member.joined', 'item.created', 'booking.approved'
  actorId: uuid("actor_id")
    .notNull()
    .references(() => member.id),
  subjectRef: text("subject_ref"), // free-form pointer to the entity involved, e.g. "item:<uuid>"
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ActivityEntry = typeof activity.$inferSelect;
export type NewActivityEntry = typeof activity.$inferInsert;
