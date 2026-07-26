import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const member = pgTable("member", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberNumber: integer("member_number").unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarPath: text("avatar_path"),
  bio: text("bio"),
  phone: text("phone"),
  role: text("role").notNull().default("member"), // 'member' | 'admin'
  invitedById: uuid("invited_by_id").references((): AnyPgColumn => member.id),
  notifPrefs: jsonb("notif_prefs").notNull().default({}),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Member = typeof member.$inferSelect;
export type NewMember = typeof member.$inferInsert;
