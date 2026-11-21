import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { member } from "./member";

/**
 * « Loups-garous » (jeux/loups): a meneur's helper for the card game. The meneur is a member; the
 * players are names in the meneur's own book (`wolf_player`), a club member or a free first name,
 * so their games add up in the stats. Players with a phone open the game's link (`token`), read the
 * rules of the deck and, when the CLHUB deals, see their own card.
 */
export const wolfPlayer = pgTable(
  "wolf_player",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerMemberId: uuid("owner_member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** When the player is a club member. */
    memberId: uuid("member_id").references(() => member.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wolf_player_owner_name_idx").on(t.ownerMemberId, sql`lower(${t.name})`)],
);

/**
 * `status`: setup (players and deck), dealing (the CLHUB dealt, phones are looking at their card),
 * playing, done. `deck` is { roleId: count }; `state` is the meneur's memory (modules/loups/domain/game
 * Tracker); `history` keeps the last states for « Annuler ».
 */
export const wolfGame = pgTable("wolf_game", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  token: text("token").notNull().unique(),
  hostMemberId: uuid("host_member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("setup"),
  /** cards: a real deck, the meneur learns the roles as he calls them. app: the CLHUB draws. */
  dealMode: text("deal_mode").notNull().default("cards"),
  deck: jsonb("deck").$type<Record<string, number>>().notNull().default({}),
  plague: boolean("plague").notNull().default(true),
  nightOrder: jsonb("night_order").$type<string[]>(),
  state: jsonb("state").$type<Record<string, unknown>>(),
  history: jsonb("history").$type<unknown[]>().notNull().default([]),
  /** village, loups, amoureux, loupblanc, personne. */
  winner: text("winner"),
  /** The game ended on « peste noire »: no wolf was dealt. */
  blackPlague: boolean("black_plague").notNull().default(false),
  previousGameId: uuid("previous_game_id").references((): AnyPgColumn => wolfGame.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

/** One player at the table. `role` is the card now (the servante can change it), `startRole` the one dealt. */
export const wolfSeat = pgTable(
  "wolf_seat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => wolfGame.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => wolfPlayer.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    role: text("role"),
    startRole: text("start_role"),
    alive: boolean("alive").notNull().default(true),
    diedTurn: integer("died_turn"),
    deathOrder: integer("death_order"),
    deathCause: text("death_cause"),
    /** The random key a phone keeps once its player said « c'est moi ». */
    claimKey: text("claim_key"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("wolf_seat_game_player_idx").on(t.gameId, t.playerId)],
);

/** A meneur's own wording of a card's rule, shown to their players instead of the default. */
export const wolfRule = pgTable(
  "wolf_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerMemberId: uuid("owner_member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull(),
    text: text("text").notNull(),
  },
  (t) => [uniqueIndex("wolf_rule_owner_role_idx").on(t.ownerMemberId, t.roleId)],
);

export type WolfGame = typeof wolfGame.$inferSelect;
export type WolfSeat = typeof wolfSeat.$inferSelect;
export type WolfPlayer = typeof wolfPlayer.$inferSelect;
