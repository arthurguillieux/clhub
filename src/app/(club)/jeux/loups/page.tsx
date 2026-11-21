import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Card } from "@/core/ui/components/Card";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { getStats, listGames } from "@/modules/loups/data/games";
import { WINNER_LABELS, type Winner } from "@/modules/loups/domain/game";
import { newGameAction } from "@/app/(loups)/loups/actions";
import { NewGameButton } from "./NewGameButton";

export const metadata: Metadata = { title: "Loups-garous" };

const STATUS: Record<string, string> = { setup: "en préparation", dealing: "distribution", playing: "en cours", done: "terminée" };
const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

/** The meneur's corner: a new game, the games played, and the stats of the table. Only theirs. */
export default async function LoupsHomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx
  const [games, stats] = await Promise.all([listGames(session.member.id), getStats(session.member.id)]);
  const link = "-my-2.5 py-2.5 text-sm font-semibold text-primary hover:underline";

  return (
    <Container size="sm">
      <Link href="/jeux" className="text-sm font-medium text-muted hover:text-ink">
        ← Jeux
      </Link>
      <div className="mt-2">
        <PageTitle>Loups-garous</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        L&apos;aide du meneur : le deck proposé selon le nombre de joueurs, les cartes tirées au sort si personne n&apos;a de jeu, l&apos;ordre des appels de la nuit, et la mémoire de
        tout ce qui s&apos;est passé (amoureux, potions, protections…). Les joueurs reçoivent un lien avec les règles de leurs cartes.
      </p>
      <form action={newGameAction} className="mt-5">
        <NewGameButton />
      </form>

      {games.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Tes parties</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {games.map((g) => (
              <Card key={g.code} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-display font-bold text-ink">
                    {day(g.createdAt)} · {g.players} joueurs
                  </p>
                  <p className="text-xs text-muted">
                    {g.status === "done" && g.winner ? WINNER_LABELS[g.winner as Winner] : STATUS[g.status]}
                    {g.blackPlague && " · peste noire"}
                  </p>
                </div>
                <Link href={`/loups/${g.code}/meneur`} className={link}>
                  {g.status === "done" ? "Revoir" : "Reprendre"}
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      {stats.games > 0 && (
        <section className="mt-8">
          <SectionTitle>Tes stats</SectionTitle>
          <Card className="mt-3 p-4">
            <p className="font-display text-lg font-bold text-ink">
              {stats.games === 1 ? "1 partie menée" : `${stats.games} parties menées`}
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {(Object.keys(WINNER_LABELS) as Winner[])
                .filter((w) => stats.byWinner[w])
                .map((w) => (
                  <li key={w} className="flex justify-between gap-3">
                    <span>{WINNER_LABELS[w]}</span>
                    <span className="font-semibold tabular-nums">{stats.byWinner[w]}</span>
                  </li>
                ))}
              {stats.blackPlagues > 0 && (
                <li className="flex justify-between gap-3 text-muted">
                  <span>dont pestes noires</span>
                  <span className="tabular-nums">{stats.blackPlagues}</span>
                </li>
              )}
            </ul>
          </Card>
          <Card className="mt-3 overflow-x-auto p-4">
            <p className="font-display font-bold text-ink">Le carnet des joueurs</p>
            <p className="text-xs text-muted">Par ordre alphabétique. « Tours » : nuits et jours vécus en moyenne par partie.</p>
            <table className="mt-3 w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-2 font-medium">Joueur</th>
                  <th className="px-2 py-1 text-right font-medium">Parties</th>
                  <th className="px-2 py-1 text-right font-medium">Tours</th>
                  <th className="px-2 py-1 text-right font-medium">En vie à la fin</th>
                  <th className="py-1 pl-2 text-right font-medium">Premier mort</th>
                </tr>
              </thead>
              <tbody>
                {stats.players.map((p) => (
                  <tr key={p.playerId} className="border-t border-line">
                    <td className="py-1.5 pr-2 font-semibold">{p.name}</td>
                    <td className="px-2 py-1.5 text-right">{p.games}</td>
                    <td className="px-2 py-1.5 text-right">{p.averageTurns.toLocaleString("fr-FR")}</td>
                    <td className="px-2 py-1.5 text-right">{p.survived}</td>
                    <td className="py-1.5 pl-2 text-right">{p.firstOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>Les règles des cartes</SectionTitle>
        <p className="mt-1 text-sm text-muted">Ce que lisent tes joueurs sur le lien de la partie. Réécris-les à ta façon, avec tes règles maison.</p>
        <Link href="/jeux/loups/regles" className={`${link} mt-2 inline-block`}>
          Modifier les règles →
        </Link>
      </section>
    </Container>
  );
}
