import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { item } from "./item";
import { member } from "./member";

/**
 * One row per signalement or entretien on an item — a lightweight, public
 * history so a broken tool's story is visible before anyone tries to borrow
 * it. 'issue' entries flip the item to 'broken' (see reportIssue);
 * 'maintenance' entries are the owner saying it's fixed again.
 */
export const maintenanceLog = pgTable("maintenance_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => item.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => member.id),
  kind: text("kind").notNull(), // 'issue' | 'maintenance'
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MaintenanceLog = typeof maintenanceLog.$inferSelect;
export type NewMaintenanceLog = typeof maintenanceLog.$inferInsert;
