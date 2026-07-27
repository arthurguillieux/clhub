import { pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "Caisse commune" (docs/01-produit.md §3) — un journal tout simple, dans le
 * même esprit que les menus : une contribution ajoute au pot, une dépense en
 * retire, le solde est juste la somme. Pas de répartition ni de remboursement
 * entre membres — ce n'est pas Splitwise, juste "combien reste dans la caisse".
 */
export const caisseTransaction = pgTable("caisse_transaction", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(), // 'contribution' | 'expense'
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CaisseTransaction = typeof caisseTransaction.$inferSelect;
export type NewCaisseTransaction = typeof caisseTransaction.$inferInsert;
