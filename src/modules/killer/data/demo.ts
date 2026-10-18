import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { db } from "@/core/db/client";
import { killerPlayer, type KillerGame } from "@/core/db/schema";
import { createGame } from "./games";

/**
 * A ready-made "Test" game to see the Killer full-size before the real evening: twelve made-up
 * tributes with missions, ten already "signed up" with a drawn portrait, two seats left free so
 * the organizer can join from their own phone. Everything else is a normal game.
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

/** A hooded silhouette on a glowing ground — no text, so it renders the same without system fonts. */
function portraitSvg(i: number): string {
  const hue = (180 + i * 17) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="80%">
      <stop offset="0" stop-color="hsl(${hue} 80% 96%)"/>
      <stop offset="0.65" stop-color="hsl(${hue} 55% 82%)"/>
      <stop offset="1" stop-color="hsl(${hue} 45% 68%)"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <path d="M60 400 C70 300 130 262 200 262 C270 262 330 300 340 400 Z" fill="hsl(${hue} 30% 32%)"/>
  <path d="M200 70 C135 70 112 130 116 190 C120 250 160 286 200 286 C240 286 280 250 284 190 C288 130 265 70 200 70 Z" fill="hsl(${hue} 30% 32%)"/>
  <ellipse cx="200" cy="196" rx="52" ry="64" fill="hsl(${hue} 35% 16%)"/>
  <circle cx="181" cy="190" r="6" fill="hsl(195 100% 75%)"/>
  <circle cx="219" cy="190" r="6" fill="hsl(195 100% 75%)"/>
</svg>`;
}

export async function createDemoGame(hostMemberId: string): Promise<KillerGame> {
  const game = await createGame(hostMemberId, "Test — 12 tributs");
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
