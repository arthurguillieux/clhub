import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { item } from "./item";
import { member } from "./member";

export const itemComment = pgTable("item_comment", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => item.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => member.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ItemComment = typeof itemComment.$inferSelect;
export type NewItemComment = typeof itemComment.$inferInsert;
