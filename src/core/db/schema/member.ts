import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * The app-facing profile. Identity (email, name, session) belongs to Better
 * Auth's `user` table — this is where club-specific data lives instead:
 * member number, parrainage, bio, notification preferences.
 */
export const member = pgTable("member", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  // Postgres-assigned, in creation order — avoids a race between two
  // invitations accepted at the same instant computing the same "next" number.
  memberNumber: integer("member_number").generatedAlwaysAsIdentity().unique(),
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
