import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { db } from "@/core/db/client";
import { killerPlayer, type KillerGame } from "@/core/db/schema";
import { androidSvg } from "../android";
import { createGame, deleteGame, listGamesByHost } from "./games";

/**
 * A ready-made "Test" game to see the Killer full-size before the real evening: twelve made-up
 * tributes with missions, ten already "signed up" with a drawn portrait, two seats left free so
 * the organizer can join from their own phone. Everything else is a normal game. Creating one
 * replaces the organizer's previous Test game, so trying it again never piles up old copies.
 */
const DEMO_TRIBUTES: { name: string; mission: string }[] = [
  { name: "Morgane", mission: "Lui faire goûter un bonbon dans ta main" },
  { name: "Vlad", mission: "Lui faire dire « j'ai froid »" },
  { name: "Lilith", mission: "Lui faire porter ton chapeau ou ton masque" },
  { name: "Damien", mission: "Lui faire raconter sa pire peur" },
  { name: "Salem", mission: "Lui faire faire un « check » du coude" },
  { name: "Raven", mission: "Lui faire chanter le début d'une chanson de Disney" },
  { name: "Edgar", mission: "Lui faire tenir ton verre pendant que tu refais tes lacets" },
  { name: "Mina", mission: "Lui faire prononcer le mot « citrouille »" },
  { name: "Igor", mission: "Lui faire imiter un fantôme" },
  { name: "Wanda", mission: "Lui faire prendre un selfie avec toi" },
  { name: "Boris", mission: "Lui faire avouer son film d'horreur préféré" },
  { name: "Elvira", mission: "Lui faire trinquer en disant « à la mort ! »" },
];
const FREE_SEATS = 2;

/** Each made-up agent gets its own visor light and a slight tilt of the head. */
const VISOR_GLOWS = ["#5fd3e6", "#7fe0c4", "#9cc8ff", "#c3a8ff", "#ffc46b", "#ff8fa3"];
const portraitSvg = (i: number) => androidSvg({ glow: VISOR_GLOWS[i % VISOR_GLOWS.length]!, tilt: ((i * 7) % 13) - 6 });

export const DEMO_TITLE = "Test — 12 agents";
const isDemoTitle = (title: string) => title === DEMO_TITLE || title === "Test — 12 tributs"; // the first ones were named that

export async function createDemoGame(hostMemberId: string): Promise<KillerGame> {
  for (const old of await listGamesByHost(hostMemberId)) {
    if (isDemoTitle(old.title)) await deleteGame(old);
  }
  const game = await createGame(hostMemberId, DEMO_TITLE);
  const now = Date.now();
  const rows = await Promise.all(
    DEMO_TRIBUTES.map(async (t, position) => {
      const joined = position < DEMO_TRIBUTES.length - FREE_SEATS;
      return {
        gameId: game.id,
        name: t.name,
        mission: t.mission,
        position,
        token: joined ? randomBytes(16).toString("hex") : null,
        joinedAt: joined ? new Date(now - (DEMO_TRIBUTES.length - position) * 60_000) : null,
        photo: joined ? await sharp(Buffer.from(portraitSvg(position))).webp({ quality: 78 }).toBuffer() : null,
        photoVersion: joined ? 1 : 0,
      };
    }),
  );
  await db.insert(killerPlayer).values(rows);
  return game;
}
