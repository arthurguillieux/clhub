import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "L'agenda en commun" has two independent layers: the free/busy grid
 * computed from personal calendars (sharedAvailability.ts) — which never
 * gets written to, only read — and this one, a member-created marker for
 * a shared milestone (an anniversary, a big trip). Purely informational:
 * a club_event row never feeds into anyone's busy/free computation and is
 * never pushed to any personal calendar.
 */
export const clubEvent = pgTable("club_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => member.id),
  title: text("title").notNull(),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClubEvent = typeof clubEvent.$inferSelect;
export type NewClubEvent = typeof clubEvent.$inferInsert;
