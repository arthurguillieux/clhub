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

/** Each made-up agent gets its own visor light. */
const VISOR_GLOWS = ["#5fd3e6", "#7fe0c4", "#9cc8ff", "#c3a8ff", "#ffc46b", "#ff8fa3"];

/**
 * A porcelain android bust — white shell, black glass visor, a light line for eyes — on a studio grey
 * ground. No text, so it renders the same without system fonts in the container.
 */
function portraitSvg(i: number): string {
  const glow = VISOR_GLOWS[i % VISOR_GLOWS.length]!;
  const tilt = ((i * 7) % 13) - 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="85%">
      <stop offset="0" stop-color="#eef1f4"/>
      <stop offset="0.6" stop-color="#cdd4da"/>
      <stop offset="1" stop-color="#a7b1ba"/>
    </radialGradient>
    <radialGradient id="shell" cx="38%" cy="28%" r="80%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.7" stop-color="#e9edf0"/>
      <stop offset="1" stop-color="#bfc7ce"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#cdd4da"/>
    </linearGradient>
    <linearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3c454e"/>
      <stop offset="1" stop-color="#0b0f12"/>
    </linearGradient>
    <filter id="blur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g transform="translate(200 232) scale(1.22) translate(-200 -200)">
  <path d="M48 400 C58 318 120 286 200 286 C280 286 342 318 352 400 Z" fill="url(#body)" stroke="#aeb8c1" stroke-width="2"/>
  <path d="M120 330 C150 312 250 312 280 330" fill="none" stroke="#b5bec6" stroke-width="2"/>
  <rect x="176" y="236" width="48" height="62" rx="10" fill="#2a3138"/>
  <path d="M176 254 H224 M176 270 H224" stroke="${glow}" stroke-width="2" opacity="0.8"/>
  <g transform="rotate(${tilt} 200 170)">
    <path d="M200 62 C142 62 118 112 120 166 C122 220 158 256 200 256 C242 256 278 220 280 166 C282 112 258 62 200 62 Z" fill="url(#shell)" stroke="#aeb8c1" stroke-width="2"/>
    <path d="M200 62 C200 100 200 130 200 150" stroke="#d3d9de" stroke-width="2" fill="none"/>
    <circle cx="126" cy="170" r="16" fill="#e9edf0" stroke="#aeb7bf" stroke-width="3"/>
    <circle cx="126" cy="170" r="5" fill="${glow}"/>
    <circle cx="274" cy="170" r="16" fill="#e9edf0" stroke="#aeb7bf" stroke-width="3"/>
    <path d="M136 150 C150 136 250 136 264 150 C270 170 262 198 246 204 C220 212 180 212 154 204 C138 198 130 170 136 150 Z" fill="url(#visor)"/>
    <path d="M150 148 C170 140 230 140 250 148" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" fill="none"/>
    <path d="M162 176 H238" stroke="${glow}" stroke-width="10" stroke-linecap="round" filter="url(#blur)"/>
    <path d="M164 176 H236" stroke="${glow}" stroke-width="4" stroke-linecap="round"/>
  </g>
  </g>
</svg>`;
}

export async function createDemoGame(hostMemberId: string): Promise<KillerGame> {
  const game = await createGame(hostMemberId, "Test — 12 agents");
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
