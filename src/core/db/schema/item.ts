import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { member } from "./member";

export const item = pgTable("item", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => member.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'bricolage' | 'jardinage' | 'menage' | 'festif' | 'autre'
  brand: text("brand"),
  model: text("model"),
  productUrl: text("product_url"),
  priceCents: integer("price_cents"),
  replacementValueCents: integer("replacement_value_cents"),
  condition: text("condition").notNull().default("bon"), // 'neuf' | 'bon' | 'usage' | 'fragile'
  // One row per item even for multi-unit ones (e.g. 6 trestles) — per-unit
  // availability (ADR-004) is deferred to Lot 3, this is just informational
  // until item_unit exists.
  quantity: integer("quantity").notNull().default(1),
  accessories: text("accessories"),
  consumables: text("consumables"),
  safetyNotes: text("safety_notes"),
  pickupLocation: text("pickup_location"),
  pickupNotes: text("pickup_notes"),
  autoApprove: boolean("auto_approve").notNull().default(false),
  maxLoanDays: integer("max_loan_days"),
  bufferDays: integer("buffer_days").notNull().default(0),
  status: text("status").notNull().default("available"), // 'available' | 'unavailable' | 'broken' | 'retired'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export type Item = typeof item.$inferSelect;
export type NewItem = typeof item.$inferInsert;
