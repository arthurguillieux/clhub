import Link from "next/link";
import { GroupLabel } from "@/core/ui/components/Heading";

/** One game or tool: its emoji tile, its name, one line of what it's for. */
export interface Game {
  href: string;
  icon: string;
  name: string;
  line: string;
  color: string;
}

export const EVENING: Game[] = [
  { href: "/jeux/points", icon: "🔢", name: "Points", line: "Le compteur de scores", color: "#29e0ff" },
  { href: "/jeux/des", icon: "🎲", name: "Dés", line: "d4 à d100", color: "#ff7a29" },
  { href: "/jeux/buzzer", icon: "🔔", name: "Buzzer", line: "Pour vos quiz", color: "#ffcc29" },
];

export const BIG: Game[] = [
  { href: "/jeux/loups", icon: "🐺", name: "Loups-garous", line: "L'aide du meneur : le deck, les cartes, les nuits, la mémoire de la partie.", color: "#c04dff" },
  { href: "/jeux/killer", icon: "🎯", name: "Killer", line: "Des agents, des missions secrètes, et un grand écran qui suit la partie.", color: "#ff4d4d" },
];

export const CHRISTMAS: Game[] = [
  { href: "/jeux/santa", icon: "🎁", name: "Secret Santa", line: "Le tirage au sort des cadeaux, un lien perso pour chacun.", color: "#ff3ec9" },
  { href: "/jeux/lettre", icon: "💌", name: "Lettre au Père Noël", line: "La liste d'un enfant pour toute la famille, et une cagnotte.", color: "#39ffb0" },
];

/** A game's tile: its emoji on its own colour, like the modules' tiles. */
export function Tile({ game, size = 48 }: { game: Game; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center" style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), background: `color-mix(in srgb, ${game.color} 22%, var(--surface))`, border: `1px solid color-mix(in srgb, ${game.color} 45%, transparent)`, fontSize: Math.round(size * 0.5) }} aria-hidden="true">
      {game.icon}
    </span>
  );
}

export interface Running {
  key: string;
  game: Game;
  text: string;
  href: string;
}

/** « En cours »: the games you have going, one tap away, in their colour. */
export function RunningList({ running }: { running: Running[] }) {
  if (!running.length) return null;
  return (
    <section aria-label="En cours" className="mt-6 flex flex-col gap-2">
      <GroupLabel>En cours</GroupLabel>
      <ul className="flex flex-col gap-1.5">
        {running.map((r) => (
          <li key={r.key}>
            <Link href={r.href} className="flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 text-sm text-ink hover:brightness-110" style={{ borderColor: `color-mix(in srgb, ${r.game.color} 35%, transparent)`, background: `color-mix(in srgb, ${r.game.color} 8%, var(--surface))` }}>
              <Tile game={r.game} size={34} />
              <span className="min-w-0 flex-1">
                {/* A letter's own title already names the game: no « Lettre au Père Noël · Lettre au Père Noël d'Ana ». */}
                {r.text.includes(r.game.name) ? (
                  <b>{r.text}</b>
                ) : (
                  <>
                    <b>{r.game.name}</b> · {r.text}
                  </>
                )}
              </span>
              <span className="text-muted" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A group of games as big rows (the big games, Christmas). */
export function GameRows({ label, games }: { label: string; games: Game[] }) {
  return (
    <section aria-label={label} className="mt-8 flex flex-col gap-2">
      <GroupLabel>{label}</GroupLabel>
      <ul className="flex flex-col gap-2">
        {games.map((g) => (
          <li key={g.href}>
            <Link href={g.href} className="flex items-center gap-3.5 rounded-card border border-line bg-surface p-3.5 hover:border-[color:var(--muted)]">
              <Tile game={g} size={52} />
              <span className="min-w-0 flex-1">
                <b className="font-display text-base text-ink">{g.name}</b>
                <span className="block text-sm text-muted">{g.line}</span>
              </span>
              <span className="text-muted" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The game night's tools as three small tiles. */
export function EveningTiles() {
  return (
    <section aria-label="Pour une soirée" className="mt-8 flex flex-col gap-2">
      <GroupLabel>Pour une soirée</GroupLabel>
      <div className="grid grid-cols-3 gap-2">
        {EVENING.map((g) => (
          <Link key={g.href} href={g.href} className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-3 text-center hover:border-[color:var(--muted)]">
            <Tile game={g} size={52} />
            <span className="flex flex-col">
              <b className="font-display text-sm text-ink">{g.name}</b>
              <span className="text-xs text-muted">{g.line}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const RECENT_MS = 7 * 24 * 3600 * 1000;

/** A Loups-garous game left unfinished is worth resuming for a week; older ones are forgotten setups. */
export const recentlyStarted = <T extends { status: string; createdAt: Date }>(games: T[]) => {
  const since = Date.now() - RECENT_MS;
  return games.filter((g) => g.status !== "done" && g.createdAt.getTime() > since);
};
