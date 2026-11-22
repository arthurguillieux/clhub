import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { getStats, listGames } from "@/modules/loups/data/games";
import { WINNER_LABELS, type Winner } from "@/modules/loups/domain/game";
import { newGameAction } from "@/app/(loups)/loups/actions";
import { NewGameButton } from "./NewGameButton";

export const metadata: Metadata = { title: "Loups-garous" };

const STATUS: Record<string, string> = { setup: "en préparation", dealing: "distribution", playing: "en cours", done: "terminée" };
const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
const num = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const SHORT: Record<Winner, string> = { village: "Village", loups: "Loups-garous", amoureux: "Amoureux", loupblanc: "Loup blanc", personne: "Personne" };
const BAR: Record<Winner, [string, string]> = {
  village: ["#e5dcbf", "#171213"],
  loups: ["#c8502a", "#fff4e2"],
  amoureux: ["#8a5a44", "#fff4e2"],
  loupblanc: ["#5b4a42", "#fff4e2"],
  personne: ["#171213", "#fff4e2"],
};

/** The meneur's corner, in the poster's colours: a new game, the table's activity, the games, the players. Only theirs. */
export default async function LoupsHomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx
  const [games, stats] = await Promise.all([listGames(session.member.id), getStats(session.member.id)]);
  const a = stats.activity;
  const link = "-my-2.5 py-2.5 text-sm font-semibold text-[var(--w-rust)] hover:underline";

  return (
    <div className="loups-poster mx-auto my-4 max-w-3xl px-5 py-7 sm:px-8">
      <Link href="/jeux" className="loups-muted relative text-sm">
        ← Jeux
      </Link>
      <p className="loups-label mt-4 pl-24 sm:pl-28">Une soirée jeux entre amis</p>
      <h1 className="loups-title text-5xl sm:text-6xl">Loups-garous</h1>
      <p className="loups-muted mt-3 max-w-prose text-sm">
        L&apos;aide du meneur : le deck proposé selon le nombre de joueurs, les cartes tirées au sort si personne n&apos;a de jeu, l&apos;ordre des appels de la nuit, la mémoire de tout ce qui
        s&apos;est passé, et un écran pour la salle si l&apos;envie t&apos;en prend.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <form action={newGameAction}>
          <NewGameButton />
        </form>
        <Link href="/jeux/loups/scenarios" className="loups-btn-ghost min-h-12 px-5">
          🎭 Scénarios spéciaux
        </Link>
      </div>

      {a.games > 0 && (
        <section className="mt-9">
          <h2 className="loups-label">Notre activité</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [num(a.games), a.games > 1 ? "parties jouées" : "partie jouée"],
              [a.minutes !== null ? `${a.minutes} min` : "—", "par partie"],
              [num(a.perEvening), "parties par soirée"],
              [num(a.players), "joueurs par partie"],
            ].map(([n, label]) => (
              <div key={label} className="loups-raised px-3 py-2.5">
                <p className="loups-title text-3xl tabular-nums">{n}</p>
                <p className="loups-muted text-xs">{label}</p>
              </div>
            ))}
          </div>
          <p className="loups-muted mt-2 text-xs">
            {num(a.nights)} nuits par partie en moyenne · {a.evenings} {a.evenings > 1 ? "soirées" : "soirée"}
            {a.blackPlagues ? ` · ${a.blackPlagues} peste${a.blackPlagues > 1 ? "s" : ""} noire${a.blackPlagues > 1 ? "s" : ""}` : ""}
          </p>
          {/* Who wins: one bar, the share of each side. */}
          <div className="mt-4 flex h-9 overflow-hidden rounded-md border border-[var(--w-line)]" role="img" aria-label={a.shares.map((s) => `${SHORT[s.winner]} ${s.percent} %`).join(", ")}>
            {a.shares.map((s) => (
              <div key={s.winner} className="flex items-center justify-center overflow-hidden text-xs font-bold" style={{ width: `${s.percent}%`, background: BAR[s.winner][0], color: BAR[s.winner][1] }}>
                {s.percent >= 12 ? `${s.percent} %` : ""}
              </div>
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {a.shares.map((s) => (
              <li key={s.winner}>
                <b>{SHORT[s.winner]}</b> {s.games} · {s.percent} %
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.players.length > 0 && (
        <section className="mt-9 overflow-x-auto">
          <h2 className="loups-label">Le carnet des joueurs</h2>
          <p className="loups-muted text-xs">Par ordre alphabétique. « Tours » : nuits et jours vécus en moyenne par partie.</p>
          <table className="mt-3 w-full text-sm tabular-nums">
            <thead>
              <tr className="loups-muted text-left text-xs">
                <th className="py-1 pr-2 font-medium">Joueur</th>
                <th className="px-2 py-1 text-right font-medium">Parties</th>
                <th className="px-2 py-1 text-right font-medium">Victoires</th>
                <th className="px-2 py-1 text-right font-medium">Tours</th>
                <th className="px-2 py-1 text-right font-medium">En vie à la fin</th>
                <th className="py-1 pl-2 text-right font-medium">Premier mort</th>
              </tr>
            </thead>
            <tbody>
              {stats.players.map((p) => (
                <tr key={p.playerId} className="border-t border-[var(--w-line)]">
                  <td className="py-1.5 pr-2 font-semibold">{p.name}</td>
                  <td className="px-2 py-1.5 text-right">{p.games}</td>
                  <td className="px-2 py-1.5 text-right">
                    {p.wins} <span className="loups-muted text-xs">({Math.round((p.wins / p.games) * 100)} %)</span>
                  </td>
                  <td className="px-2 py-1.5 text-right">{p.averageTurns.toLocaleString("fr-FR")}</td>
                  <td className="px-2 py-1.5 text-right">{p.survived}</td>
                  <td className="py-1.5 pl-2 text-right">{p.firstOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {games.length > 0 && (
        <section className="mt-9">
          <h2 className="loups-label">Tes parties</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {games.map((g) => (
              <li key={g.code} className="loups-raised flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-bold">
                    {day(g.createdAt)} · {g.players} joueurs
                  </p>
                  <p className="loups-muted text-xs">
                    {g.status === "done" && g.winner ? WINNER_LABELS[g.winner as Winner] : STATUS[g.status]}
                    {g.blackPlague && " · peste noire"}
                  </p>
                </div>
                <Link href={`/loups/${g.code}/meneur`} className={link}>
                  {g.status === "done" ? "Revoir" : "Reprendre"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-9 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="loups-label">Les règles des cartes</h2>
          <p className="loups-muted mt-1 text-sm">Ce que lisent tes joueurs sur le lien de la partie, à ta façon, avec tes règles maison.</p>
          <Link href="/jeux/loups/regles" className={`${link} mt-2 inline-block`}>
            Modifier les règles →
          </Link>
        </div>
        <div>
          <h2 className="loups-label">Tes cartes illustrées</h2>
          <p className="loups-muted mt-1 text-sm">Les images de ton jeu, pour qu&apos;une carte révélée se retourne avec son vrai dessin.</p>
          <Link href="/jeux/loups/cartes" className={`${link} mt-2 inline-block`}>
            Ajouter les images →
          </Link>
        </div>
      </section>
    </div>
  );
}
