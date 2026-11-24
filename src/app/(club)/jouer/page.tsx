import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PoleHeader } from "@/core/ui/components/PolePage";
import { listGamesForMember as killerGames } from "@/modules/killer/data/games";
import { listGames as wolfGames } from "@/modules/loups/data/games";
import { BIG, EveningTiles, GameRows, RunningList, recentlyStarted, type Running } from "../jeux/games";

export const metadata: Metadata = { title: "Jouer" };

/** Jouer: your games going, then the big games and the game night's tools. */
export default async function JouerPage() {
  const me = (await getSession())!.member.id;
  const [killer, wolves] = await Promise.all([killerGames(me), wolfGames(me)]);
  const [loups, killerGame] = BIG;
  const running: Running[] = [
    ...killer.filter((g) => !g.archivedAt && g.status !== "ended").map((g) => ({ key: `k-${g.id}`, game: killerGame!, text: g.title, href: `/killer/${g.code}/panneau` })),
    ...recentlyStarted(wolves)
      .slice(0, 2)
      .map((g) => ({ key: `w-${g.code}`, game: loups!, text: `Partie de ${g.players} joueurs · à reprendre`, href: `/loups/${g.code}/meneur` })),
  ];
  return (
    <Container size="md">
      <PoleHeader pole="jouer" />
      <RunningList running={running} />
      <GameRows label="Les grands jeux" games={BIG} />
      <EveningTiles />
    </Container>
  );
}
