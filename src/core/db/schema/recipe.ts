import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "Nos recettes" (docs/01-produit.md §3) — le livre de recettes du club, à
 * plusieurs mains : un membre ajoute une recette, tout le monde la consulte.
 * Pas de notation ni de commentaires pour cette première version — juste le
 * texte, comme un vrai carnet de recettes qu'on se passe.
 */
export const recipe = pgTable("recipe", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => member.id),
  title: text("title").notNull(),
  ingredients: text("ingredients").notNull(),
  instructions: text("instructions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Recipe = typeof recipe.$inferSelect;
export type NewRecipe = typeof recipe.$inferInsert;
