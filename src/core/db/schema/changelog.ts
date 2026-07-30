import { pgTable, uuid, date, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Entries for the homepage "Nouveautés" log. Written by Claude across dev
 * sessions, not by members — there's no member-facing create form by design.
 * Grouped by `entryDate` at display time (a day can have several entries),
 * not by `createdAt`, so backfilling a day's highlights after the fact
 * still lands them together.
 */
export const changelogEntry = pgTable("changelog_entry", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChangelogEntry = typeof changelogEntry.$inferSelect;
export type NewChangelogEntry = typeof changelogEntry.$inferInsert;
