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
  // A single cover photo for now — item_photo (multiple, reorderable) is a
  // later Lot 2b item once the gallery UI actually needs it.
  photoPath: text("photo_path"),
  category: text("category").notNull(), // 'bricolage' | 'jardinage' | 'menage' | 'festif' | 'autre'
  brand: text("brand"),
  model: text("model"),
  productUrl: text("product_url"),
  priceCents: integer("price_cents"),
  replacementValueCents: integer("replacement_value_cents"),
  condition: text("condition").notNull().default("bon"), // 'neuf' | 'bon' | 'usage' | 'fragile'
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
