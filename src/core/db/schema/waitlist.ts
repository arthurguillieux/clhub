import { pgTable, uuid, date, timestamp } from "drizzle-orm/pg-core";
import { item } from "./item";
import { member } from "./member";

/**
 * One row per "prévens-moi si ça se libère" — a member's desired range on an
 * item that was unavailable when they asked. `notifiedAt` is set the first
 * time that range becomes bookable again; entries aren't deleted on
 * notification so a member can still see what they signed up for.
 */
export const waitlistEntry = pgTable("waitlist_entry", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => item.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
});

export type WaitlistEntry = typeof waitlistEntry.$inferSelect;
export type NewWaitlistEntry = typeof waitlistEntry.$inferInsert;
