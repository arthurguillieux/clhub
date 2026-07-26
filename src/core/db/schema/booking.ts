import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";
import { item } from "./item";
import { member } from "./member";

/**
 * The exclusion constraint that makes double-booking a single item
 * physically impossible — `EXCLUDE USING gist` on (item_id, daterange) for
 * 'approved'/'active' rows — is added by raw SQL appended to this table's
 * migration, since Drizzle's schema builder has no representation for it.
 * See docs/02-architecture.md §3.3 and drizzle/0003_*.sql.
 */
export const booking = pgTable("booking", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => item.id),
  borrowerId: uuid("borrower_id")
    .notNull()
    .references(() => member.id),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  startSlot: text("start_slot"), // 'matin' | 'aprem' | 'soir', null = whole day
  endSlot: text("end_slot"),
  status: text("status").notNull().default("pending"),
  // 'pending' | 'approved' | 'rejected' | 'cancelled' | 'active' | 'returned'
  message: text("message"),
  ownerNote: text("owner_note"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  respondedBy: uuid("responded_by").references(() => member.id),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  returnCondition: text("return_condition"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Booking = typeof booking.$inferSelect;
export type NewBooking = typeof booking.$inferInsert;
