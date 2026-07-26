import { pgTable, uuid, text, date, timestamp, unique } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * "Cherche décolleuse à papier peint pour le 20" — per docs/01-produit.md
 * §5.5. Deliberately doesn't model the resulting co-ownership when a group
 * buy happens: who's actually responsible for a jointly-bought item is a
 * real product decision, not something to guess at in code. This just
 * covers the request + interest + threshold-notification part.
 */
export const wantedPost = pgTable("wanted_post", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => member.id),
  title: text("title").notNull(),
  description: text("description"),
  neededBy: date("needed_by", { mode: "string" }),
  status: text("status").notNull().default("open"), // 'open' | 'closed'
  groupBuyTriggeredAt: timestamp("group_buy_triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wantedInterest = pgTable(
  "wanted_interest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wantedPostId: uuid("wanted_post_id")
      .notNull()
      .references(() => wantedPost.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.wantedPostId, table.memberId)],
);

export type WantedPost = typeof wantedPost.$inferSelect;
export type NewWantedPost = typeof wantedPost.$inferInsert;
export type WantedInterest = typeof wantedInterest.$inferSelect;
