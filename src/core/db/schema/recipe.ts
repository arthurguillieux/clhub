import { pgTable, uuid, text, integer, timestamp, primaryKey, smallint } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "Nos recettes" (docs/01-produit.md §3) — le livre de recettes du club, à
 * plusieurs mains : un membre ajoute une recette, tout le monde la consulte,
 * note et commente. Matériel/temps façon Jow — prépa et cuisson séparés,
 * pas de découpe en étapes chronométrées, ce n'est pas l'ambition ici.
 */
export const recipe = pgTable("recipe", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => member.id),
  title: text("title").notNull(),
  equipment: text("equipment"),
  servings: integer("servings"),
  prepMinutes: integer("prep_minutes"),
  cookMinutes: integer("cook_minutes"),
  ingredients: text("ingredients").notNull(),
  instructions: text("instructions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One review per member, updatable — not a running log of every opinion someone's ever had. */
export const recipeReview = pgTable(
  "recipe_review",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    rating: smallint("rating").notNull(), // 1-5
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.memberId] })],
);

export type Recipe = typeof recipe.$inferSelect;
export type NewRecipe = typeof recipe.$inferInsert;
export type RecipeReview = typeof recipeReview.$inferSelect;
export type NewRecipeReview = typeof recipeReview.$inferInsert;
