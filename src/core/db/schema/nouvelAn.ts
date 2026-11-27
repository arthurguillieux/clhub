import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, date, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * « Nouvel an » (Célébrer): the New Year's Eve of the old gîte days, with its habits of military
 * organization — one edition a year, often taken over from last year's (`previousEditionId`).
 *
 * The organizers (the creator and their co-organizers) set everything up: the dates, the guests
 * (club members, or anyone with an email: their personal link opens their page without an
 * account), the meals, who does what, the lists whose quantities follow the headcount, the budget.
 * The guests answer, take on a mission, note what they paid out of their own pocket, and say
 * « j'ai payé »; the organizers confirm what they received and remind those who haven't.
 * The club handles no money: everything here is what people declare.
 */
export const nyeEdition = pgTable("nye_edition", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  hostMemberId: uuid("host_member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  endsOn: date("ends_on", { mode: "string" }).notNull(),
  place: text("place").notNull().default(""),
  /** The organizers' word to the guests, on their page and in the invitation. */
  message: text("message").notNull().default(""),
  /** How to pay, as written in the request: « Wero au 06 12 34 56 78, ou virement à Justine ». */
  paymentInfo: text("payment_info").notNull().default(""),
  /** When the lists should be computed on another headcount than the guests who said yes. */
  headcountOverride: integer("headcount_override"),
  previousEditionId: uuid("previous_edition_id").references((): AnyPgColumn => nyeEdition.id, { onDelete: "set null" }),
  requestSentAt: timestamp("request_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nyeCohost = pgTable(
  "nye_cohost",
  {
    editionId: uuid("edition_id")
      .notNull()
      .references(() => nyeEdition.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.editionId, t.memberId] })],
);

/**
 * A way of taking part at its own price (the gîte's « bâtiment A », « chambre partagée »…). When an
 * edition has options, the cost lines split « selon l'option » are paid through them.
 */
export const nyeOption = pgTable(
  "nye_option",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => nyeEdition.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("nye_option_edition_idx").on(t.editionId)],
);

/**
 * A guest: a club member (`memberId`, their address read from their account) or anyone with an
 * `email`. `token` is the secret of their personal page. `days`: the dates they are there (all of
 * them by default). Payments are declared: « j'ai payé » (`paidDeclaredAt`), then what the
 * organizers confirm having received (`receivedCents`).
 */
export const nyeGuest = pgTable(
  "nye_guest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => nyeEdition.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => member.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    token: text("token").notNull().unique(),
    /** pending | yes | maybe | no */
    answer: text("answer").notNull().default("pending"),
    days: jsonb("days").$type<string[] | null>(),
    optionId: uuid("option_id").references(() => nyeOption.id, { onDelete: "set null" }),
    diet: text("diet").notNull().default(""),
    note: text("note").notNull().default(""),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    mailError: text("mail_error"),
    paidDeclaredAt: timestamp("paid_declared_at", { withTimezone: true }),
    receivedCents: integer("received_cents").notNull().default(0),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nye_guest_edition_idx").on(t.editionId), index("nye_guest_member_idx").on(t.memberId), uniqueIndex("nye_guest_edition_member_idx").on(t.editionId, t.memberId)],
);

/** A meal of the evening: its day, its moment (« Soir », « Midi », « Apéro »), its menu, who cooks. */
export const nyeMeal = pgTable(
  "nye_meal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => nyeEdition.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    label: text("label").notNull(),
    menu: text("menu").notNull().default(""),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("nye_meal_edition_idx").on(t.editionId)],
);

/**
 * Who does what: a mission in a pole (« Manger / boire », « Fun »…), its deadline in words (« 20
 * novembre », « dernière minute »), its progress. Meals' cooking is a mission like the others.
 */
export const nyeTask = pgTable(
  "nye_task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => nyeEdition.id, { onDelete: "cascade" }),
    pole: text("pole").notNull(),
    title: text("title").notNull(),
    due: text("due").notNull().default(""),
    /** todo | doing | done */
    status: text("status").notNull().default("todo"),
    note: text("note").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nye_task_edition_idx").on(t.editionId)],
);

export const nyeTaskGuest = pgTable(
  "nye_task_guest",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => nyeTask.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => nyeGuest.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.guestId] })],
);

/**
 * A shopping list (« Boissons », « Courses », « Matos et déco »…): its total goes to the budget,
 * split between the guests by their presence (food and drinks) or equally (the rest).
 */
export const nyeList = pgTable(
  "nye_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => nyeEdition.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** presence | equal */
    split: text("split").notNull().default("presence"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("nye_list_edition_idx").on(t.editionId)],
);

/**
 * A line of a list. Its quantity follows a rule — fixed, per person, per person and per day, per
 * person and per meal — times `ratio`, minus what is already in `stock`, rounded up to whole packs
 * of `perPack`. `overridePacks` wins when the organizers know better. `guestId`: who takes care of it.
 */
export const nyeItem = pgTable(
  "nye_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => nyeList.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** fixed | person | person_day | person_meal */
    rule: text("rule").notNull().default("fixed"),
    ratio: real("ratio").notNull().default(1),
    /** What one unit is (« bouteille 75 cl »), and what one buys (« pack de 20 » = 20 units). */
    unit: text("unit").notNull().default(""),
    perPack: integer("per_pack").notNull().default(1),
    packPriceCents: integer("pack_price_cents"),
    stock: real("stock").notNull().default(0),
    overridePacks: integer("override_packs"),
    guestId: uuid("guest_id").references(() => nyeGuest.id, { onDelete: "set null" }),
    bought: boolean("bought").notNull().default(false),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("nye_item_list_idx").on(t.listId)],
);

/**
 * A cost that isn't a list (the place, the sound system, the games): its estimate, and how it is
 * split — « options » (paid through each guest's option price), « equal », or « presence ».
 */
export const nyeCost = pgTable(
  "nye_cost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => nyeEdition.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    cents: integer("cents").notNull().default(0),
    split: text("split").notNull().default("equal"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("nye_cost_edition_idx").on(t.editionId)],
);

/**
 * Money a guest paid out of their own pocket for the evening (the drinks run, the deposit). Tied to
 * a cost line or a list (`costId` / `listId`): once a budget line has real expenses, they replace its
 * estimate in everyone's part; what someone advanced is taken off what they owe.
 */
export const nyeExpense = pgTable(
  "nye_expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => nyeEdition.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => nyeGuest.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    cents: integer("cents").notNull(),
    costId: uuid("cost_id").references(() => nyeCost.id, { onDelete: "set null" }),
    listId: uuid("list_id").references(() => nyeList.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nye_expense_edition_idx").on(t.editionId)],
);

export type NyeEdition = typeof nyeEdition.$inferSelect;
export type NyeGuest = typeof nyeGuest.$inferSelect;
export type NyeItem = typeof nyeItem.$inferSelect;
