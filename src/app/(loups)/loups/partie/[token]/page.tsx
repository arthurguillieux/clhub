import type { Metadata, Viewport } from "next";
import { getGameByToken, getPlayerView } from "@/modules/loups/data/games";
import { PlayerScreen } from "./PlayerScreen";

export const metadata: Metadata = { title: "Loups-garous", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const viewport: Viewport = { themeColor: "#0e1220" };

/** Where the QR code lands, no account needed: the deck and its rules, and your own card when the CLHUB deals. */
export default async function PlayerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const game = await getGameByToken(token);
  if (!game)
    return (
      <main className="loups flex items-center justify-center px-4">
        <div className="loups-panel max-w-sm p-6 text-center">
          <h1 className="loups-title text-2xl">Cette partie n&apos;existe plus</h1>
          <p className="loups-muted mt-2 text-sm">Demande au meneur le lien de la partie en cours.</p>
        </div>
      </main>
    );
  return (
    <main>
      <PlayerScreen token={token} initialView={await getPlayerView(game, null)} />
    </main>
  );
}
