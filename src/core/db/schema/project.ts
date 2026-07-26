import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "Chantiers" (docs/01-produit.md §5.4) — one project bundles several
 * item bookings under one name and date range so a member can ask for
 * everything a project needs in one go and track it as a whole. The
 * bookings themselves stay ordinary `booking` rows (one per item, each
 * still validated and approved independently by its own owner) — this
 * table is just the grouping label they point back to via `booking.projectId`.
 */
export const project = pgTable("project", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => member.id),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
