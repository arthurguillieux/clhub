import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Unlike Prêtothèque's CATEGORIES (a fixed TypeScript const), these live in
 * the DB — Arthur wants admins to add a category later without a code
 * deploy (see /admin/dons). Seeded once with a starting set matching
 * Prêtothèque's own list, purely as a sensible default.
 */
export const donCategory = pgTable("don_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DonCategory = typeof donCategory.$inferSelect;
export type NewDonCategory = typeof donCategory.$inferInsert;
