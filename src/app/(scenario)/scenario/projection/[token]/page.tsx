import type { Metadata, Viewport } from "next";
import { getByToken, getProjectionView } from "@/modules/loups/scenarios/data";
import { scenarioOf } from "@/modules/loups/scenarios";
import { Projection } from "./Projection";

export const metadata: Metadata = { title: "Projection", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const viewport: Viewport = { themeColor: "#05080c" };

/** The screen the room sees, opened on the projection computer by its secret link: no account needed. */
export default async function ProjectionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const game = await getByToken(token);
  const def = game ? scenarioOf(game.scenarioId) : null;
  if (!game || !def)
    return (
      <main className="scn flex items-center justify-center">
        <p className="scn-vt text-4xl text-[var(--scn-ice-dim)]">SIGNAL PERDU</p>
      </main>
    );
  const { passwordSha256, ...pub } = def;
  void passwordSha256;
  return (
    <main className="scn">
      <Projection token={token} def={pub} initial={await getProjectionView(game, def)} />
    </main>
  );
}
