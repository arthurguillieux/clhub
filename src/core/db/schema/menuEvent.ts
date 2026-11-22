import { pgTable, uuid, text, date, boolean, timestamp, primaryKey, integer, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "Les repas du CLHUB" (ex « Les menus du club », docs/01-produit.md §3 et §6) — la deuxième section,
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
  // « Les repas du CLHUB » (2026-11-22): the meal's own link for guests without an account, where
  // and when, whether any member may join, the menu it was planned from, and what it set off.
  token: text("token").unique(),
  place: text("place"),
  time: text("time"),
  /** Any club member may add themselves (the old « menus » were all open). Else: invited guests only. */
  open: boolean("open").notNull().default(false),
  /** The template of the calculator it was planned with (raclette, fondue…). */
  template: text("template"),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  /** The Caisse event opened to split its costs. */
  caisseEventId: uuid("caisse_event_id"),
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

/**
 * A meal's guests: a club member, or a first name with no account (they come through the meal's link
 * and pick their name; `claimKey` is the random key their browser keeps). `status`: yes, maybe, no,
 * or null (not answered yet). `vege` for guests without a profile (members: their dietary tags).
 */
export const mealGuest = pgTable(
  "meal_guest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => menuEvent.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => member.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status"),
    plusOnes: integer("plus_ones").notNull().default(0),
    vege: boolean("vege"),
    claimKey: text("claim_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("meal_guest_event_member_idx").on(t.eventId, t.memberId)],
);

/** A line of « qui ramène quoi »: something to bring, with or without an amount. */
export const mealItem = pgTable("meal_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => menuEvent.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" }),
  unit: text("unit"),
  /** manger, boire, materiel. */
  category: text("category").notNull().default("manger"),
  /** Who suggested it (an organizer's line has none): they may take it back. */
  addedByGuestId: uuid("added_by_guest_id").references(() => mealGuest.id, { onDelete: "set null" }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Who brings it: the whole line (`quantity` null, or the rest at the time) or part of it. */
export const mealClaim = pgTable(
  "meal_claim",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => mealItem.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => mealGuest.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" }),
    /** « Acheté ✓ », the shopping list of the day. */
    bought: boolean("bought").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("meal_claim_item_guest_idx").on(t.itemId, t.guestId)],
);

export type MealGuest = typeof mealGuest.$inferSelect;
export type MealItem = typeof mealItem.$inferSelect;
export type MealClaim = typeof mealClaim.$inferSelect;
export type MenuEvent = typeof menuEvent.$inferSelect;
export type NewMenuEvent = typeof menuEvent.$inferInsert;
export type MenuResponse = typeof menuResponse.$inferSelect;
export type NewMenuResponse = typeof menuResponse.$inferInsert;
