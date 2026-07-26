import { pgTable, uuid, text, date, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "Les menus du club" (docs/01-produit.md §3 et §6) — la deuxième section,
 * volontairement légère : elle réutilise le socle (membres, notifications,
 * flux) sans le moteur de calendrier de la Prêtothèque. Un membre propose
 * un repas pour une date donnée ; les autres répondent.
 */
export const menuEvent = pgTable("menu_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => member.id),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const menuResponse = pgTable(
  "menu_response",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => menuEvent.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    attending: boolean("attending").notNull(),
    bringing: text("bringing"),
    allergies: text("allergies"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.memberId] })],
);

export type MenuEvent = typeof menuEvent.$inferSelect;
export type NewMenuEvent = typeof menuEvent.$inferInsert;
export type MenuResponse = typeof menuResponse.$inferSelect;
export type NewMenuResponse = typeof menuResponse.$inferInsert;
