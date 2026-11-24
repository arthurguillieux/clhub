import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { GroupLabel, PageTitle } from "@/core/ui/components/Heading";
import { listGamesForMember as killerGames } from "@/modules/killer/data/games";
import { listForMember as letters } from "@/modules/lettre/data/letters";
import { listGames as wolfGames } from "@/modules/loups/data/games";
import { listForMember as santas } from "@/modules/santa/data/events";

interface Game {
  href: string;
  icon: string;
  name: string;
  /** One line: what it's for, read at a glance. */
  line: string;
  color: string;
}

const EVENING: Game[] = [
  { href: "/jeux/points", icon: "🔢", name: "Points", line: "Le compteur de scores", color: "#29e0ff" },
  { href: "/jeux/des", icon: "🎲", name: "Dés", line: "d4 à d100", color: "#ff7a29" },
  { href: "/jeux/buzzer", icon: "🔔", name: "Buzzer", line: "Pour vos quiz", color: "#ffcc29" },
];

const BIG: Game[] = [
  { href: "/jeux/loups", icon: "🐺", name: "Loups-garous", line: "L'aide du meneur : le deck, les cartes, les nuits, la mémoire de la partie.", color: "#c04dff" },
  { href: "/jeux/killer", icon: "🎯", name: "Killer", line: "Des agents, des missions secrètes, et un grand écran qui suit la partie.", color: "#ff4d4d" },
];

const CHRISTMAS: Game[] = [
  { href: "/jeux/santa", icon: "🎁", name: "Secret Santa", line: "Le tirage au sort des cadeaux, un lien perso pour chacun.", color: "#ff3ec9" },
  { href: "/jeux/lettre", icon: "💌", name: "Lettre au Père Noël", line: "La liste d'un enfant pour toute la famille, et une cagnotte.", color: "#39ffb0" },
];

/** A game's tile: its emoji on its own colour, like the sections' tiles. */
function Tile({ game, size = 48 }: { game: Game; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center" style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), background: `color-mix(in srgb, ${game.color} 22%, var(--surface))`, border: `1px solid color-mix(in srgb, ${game.color} 45%, transparent)`, fontSize: Math.round(size * 0.5) }} aria-hidden="true">
      {game.icon}
    </span>
  );
}

interface Running {
  key: string;
  game: Game;
  text: string;
  href: string;
}

const RECENT_MS = 7 * 24 * 3600 * 1000;

/** A Loups-garous game left unfinished is worth resuming for a week; older ones are forgotten setups. */
const recentlyStarted = <T extends { status: string; createdAt: Date }>(games: T[]) => {
  const since = Date.now() - RECENT_MS;
  return games.filter((g) => g.status !== "done" && g.createdAt.getTime() > since);
};

/**
 * Jeux, in the club's look (24/11/2026): the games you have going first, then the games by occasion
 * — a game night, the big games, Christmas.
 */
export default async function JeuxPage() {
  const session = (await getSession())!;
  const me = session.member.id;
  const [santa, killer, wolves, lettres] = await Promise.all([santas(me), killerGames(me), wolfGames(me), letters(me)]);
  const [loups, killerGame] = BIG;
  const [santaGame, lettreGame] = CHRISTMAS;

  const running: Running[] = [
    ...santa.organized.filter((e) => !e.archivedAt).map((e) => ({ key: `s-${e.id}`, game: santaGame!, text: `${e.title} · tu l'organises`, href: `/santa/${e.code}/panneau` })),
    ...santa.participating.map((p) => ({ key: `sp-${p.token}`, game: santaGame!, text: `${p.title} · ta page`, href: `/santa/moi/${p.token}` })),
    ...lettres.filter((l) => !l.closedAt).map((l) => ({ key: `l-${l.id}`, game: lettreGame!, text: l.title, href: `/lettre/${l.code}/panneau` })),
    ...killer.filter((g) => !g.archivedAt && g.status !== "ended").map((g) => ({ key: `k-${g.id}`, game: killerGame!, text: g.title, href: `/killer/${g.code}/panneau` })),
    ...recentlyStarted(wolves)
      .slice(0, 2)
      .map((g) => ({ key: `w-${g.code}`, game: loups!, text: `Partie de ${g.players} joueurs · à reprendre`, href: `/loups/${g.code}/meneur` })),
  ];

  return (
    <Container size="md">
      <PageTitle section="jeux">Jeux</PageTitle>

      {running.length > 0 && (
        <section aria-label="En cours" className="mt-6 flex flex-col gap-2">
          <GroupLabel>En cours</GroupLabel>
          <ul className="flex flex-col gap-1.5">
            {running.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 text-sm text-ink hover:brightness-110" style={{ borderColor: `color-mix(in srgb, ${r.game.color} 35%, transparent)`, background: `color-mix(in srgb, ${r.game.color} 8%, var(--surface))` }}>
                  <Tile game={r.game} size={34} />
                  <span className="min-w-0 flex-1">
                    {/* The letter's own title already names the game: no « Lettre au Père Noël · Lettre au Père Noël d'Ana ». */}
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
      )}

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

      {[
        { label: "Les grands jeux", games: BIG },
        { label: "Pour Noël", games: CHRISTMAS },
      ].map(({ label, games }) => (
        <section key={label} aria-label={label} className="mt-8 flex flex-col gap-2">
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
      ))}
    </Container>
  );
}
