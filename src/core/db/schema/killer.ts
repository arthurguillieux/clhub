import { pgTable, uuid, text, integer, boolean, timestamp, customType, index } from "drizzle-orm/pg-core";
import { member } from "./member";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * Killer (jeux/killer). Unlike the Buzzer, a game lives in Postgres: it lasts a
 * whole evening, and a phone or the server restarting must not lose anyone's
 * target. `version` is bumped on every change so long-polling clients know
 * when to refresh (the waiting itself happens in memory, see modules/killer).
 *
 * Status: 'lobby' (organizer edits players/missions/circle, guests claim their
 * name) → 'running' → 'ended'.
 */
export const killerGame = pgTable("killer_game", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  hostMemberId: uuid("host_member_id")
    .notNull()
    .references(() => member.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("lobby"),
  version: integer("version").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One tribute. `mission` is what will be asked *of this player* — whoever has
 * them as a target must get them to do it, and inherits it on a kill (missions
 * travel with their target). `position` is the circle order set in the lobby;
 * once running, `targetId` is the source of truth.
 */
export const killerPlayer = pgTable(
  "killer_player",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => killerGame.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mission: text("mission").notNull().default(""),
    position: integer("position").notNull(),
    /** Secret kept by the player's phone once they claim their name. */
    token: text("token"),
    photo: bytea("photo"),
    photoVersion: integer("photo_version").notNull().default(0),
    targetId: uuid("target_id"),
    alive: boolean("alive").notNull().default(true),
    killedAt: timestamp("killed_at", { withTimezone: true }),
    killedById: uuid("killed_by_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
  },
  (t) => [index("killer_player_game_idx").on(t.gameId)],
);

/** Kept so the organizer can undo the last elimination exactly. */
export const killerKill = pgTable("killer_kill", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => killerGame.id, { onDelete: "cascade" }),
  victimId: uuid("victim_id").notNull(),
  killerId: uuid("killer_id").notNull(),
  /** The victim's target at the time — what the killer inherited. */
  inheritedTargetId: uuid("inherited_target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KillerGame = typeof killerGame.$inferSelect;
export type KillerPlayer = typeof killerPlayer.$inferSelect;
export type KillerKill = typeof killerKill.$inferSelect;
