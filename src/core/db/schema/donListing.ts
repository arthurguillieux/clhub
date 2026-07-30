import { pgTable, uuid, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { member } from "./member";
import { donCategory } from "./donCategory";

/**
 * "Cabanes à dons" — don/troc/vente entre membres, un cran plus simple que
 * la Prêtothèque : pas de cycle prêt/retour, un objet part une fois pour
 * toutes. `priceText` reste du texte libre plutôt qu'un simple montant en
 * euros ("échange contre...", "10€", etc.) — `isFree` n'existe que pour
 * l'affichage rapide ("Gratuit") quand il n'y a rien à écrire.
 */
export const donListing = pgTable("don_listing", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => member.id),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => donCategory.id),
  title: text("title").notNull(),
  description: text("description"),
  photoPath: text("photo_path"),
  priceText: text("price_text"),
  isFree: boolean("is_free").notNull().default(false),
  // 'available' | 'reserved' | 'completed'
  status: text("status").notNull().default("available"),
  // Set when reserved (who it's held for); left as-is on completion, so it
  // doubles as "who it actually went to" without a second column.
  reservedForMemberId: uuid("reserved_for_member_id").references(() => member.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Order of arrival matters — the giver picks among these, sorted by createdAt, not a first-come auto-claim. */
export const donInterest = pgTable(
  "don_interest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => donListing.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.listingId, table.memberId)],
);

export type DonListing = typeof donListing.$inferSelect;
export type NewDonListing = typeof donListing.$inferInsert;
export type DonInterest = typeof donInterest.$inferSelect;
export type NewDonInterest = typeof donInterest.$inferInsert;
