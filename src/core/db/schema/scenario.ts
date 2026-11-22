import { bigserial, boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * Loups-garous › Scénarios spéciaux: evenings played from a scenario definition (modules/loups/scenarios),
 * piloted from the meneur's phone (« console ») while a projection computer shows the base. The
 * evening is its journal of actions (`scenario_action`): the state is rebuilt from it, and « Annuler »
 * deletes the last one. `version` moves on every change, for the projection's long-poll.
 */
export const scenarioGame = pgTable("scenario_game", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  /** The secret of the projection's link. */
  token: text("token").notNull().unique(),
  scenarioId: text("scenario_id").notNull(),
  hostMemberId: uuid("host_member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  /** setup, live, done. */
  status: text("status").notNull().default("setup"),
  /** Players, parameters, day events, extra faults (engine Setup). */
  setup: jsonb("setup").$type<Record<string, unknown>>().notNull(),
  version: integer("version").notNull().default(0),
  /** What the projection computer last said: when, how many media it holds, whether it may record. */
  projectionSeenAt: timestamp("projection_seen_at", { withTimezone: true }),
  mediaReady: integer("media_ready").notNull().default(0),
  mediaTotal: integer("media_total").notNull().default(0),
  micReady: boolean("mic_ready").notNull().default(false),
  previousGameId: uuid("previous_game_id").references((): AnyPgColumn => scenarioGame.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const scenarioAction = pgTable(
  "scenario_action",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => scenarioGame.id, { onDelete: "cascade" }),
    action: jsonb("action").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scenario_action_game_idx").on(t.gameId, t.seq)],
);

/** A co-organizer of an evening (Rémi at the piano), added by its creator. */
export const scenarioCohost = pgTable(
  "scenario_cohost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => scenarioGame.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("scenario_cohost_game_member_idx").on(t.gameId, t.memberId)],
);

/** A member who typed a scenario's password: it stays open for them. */
export const scenarioUnlock = pgTable(
  "scenario_unlock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    scenarioId: text("scenario_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("scenario_unlock_member_idx").on(t.memberId, t.scenarioId)],
);

export type ScenarioGame = typeof scenarioGame.$inferSelect;
