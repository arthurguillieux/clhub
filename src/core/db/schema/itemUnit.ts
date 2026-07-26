import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { item } from "./item";

/**
 * One row per physical copy of an item (ADR-004) — six trestles means six
 * rows here, each independently bookable. `label` is optional: with a single
 * active unit (the common case) the UI never needs to name it.
 * `archivedAt` retires a unit (broken beyond repair, given away) without
 * breaking the FK on bookings already made against it.
 */
export const itemUnit = pgTable("item_unit", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => item.id),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export type ItemUnit = typeof itemUnit.$inferSelect;
export type NewItemUnit = typeof itemUnit.$inferInsert;
