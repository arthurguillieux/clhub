import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { item } from "./item";

/**
 * The gallery behind `item.photoPath` — that column stays a denormalized
 * pointer to whichever row here has `isPrimary`, kept in sync by the data
 * layer, so every existing reader of `item.photoPath` (catalog grid, item
 * hero) keeps working unchanged.
 */
export const itemPhoto = pgTable("item_photo", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => item.id),
  path: text("path").notNull(),
  width: integer("width"),
  height: integer("height"),
  sort: integer("sort").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ItemPhoto = typeof itemPhoto.$inferSelect;
export type NewItemPhoto = typeof itemPhoto.$inferInsert;
