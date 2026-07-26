import { pgTable, text, boolean, integer, timestamp, jsonb, primaryKey, uuid } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * The catalog (ADR-007 — lives in the socle, not in a section module, so a
 * second section can earn badges too). Per the design in docs/01-produit.md
 * §6: "une règle est du code, l'écusson est une ligne en base" — this table
 * is the metadata (name, description, icon), matched by `key` to a pure
 * evaluator function in core/achievements/catalog.ts. The rule itself is
 * never stored as data.
 */
export const achievement = pgTable("achievement", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  // Shown only to members who haven't unlocked it yet, for secret badges — a
  // little nudge without spoiling the exact condition.
  hint: text("hint"),
  icon: text("icon").notNull(),
  secret: boolean("secret").notNull().default(false),
  sort: integer("sort").notNull().default(0),
});

export const memberAchievement = pgTable(
  "member_achievement",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    achievementKey: text("achievement_key")
      .notNull()
      .references(() => achievement.key),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    // Free-form snapshot of the numbers that earned it — e.g. {"streak": 10} —
    // purely for display ("10 retours à l'heure d'affilée"), never re-evaluated.
    progress: jsonb("progress"),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.achievementKey] })],
);

export type Achievement = typeof achievement.$inferSelect;
export type MemberAchievement = typeof memberAchievement.$inferSelect;
export type NewMemberAchievement = typeof memberAchievement.$inferInsert;
