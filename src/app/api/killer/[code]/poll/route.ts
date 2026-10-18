import { getGameByCode, getPlayerView, getPublicView } from "@/modules/killer/data/games";
import { waitForChange } from "@/modules/killer/data/notifier";
import { jsonError, jsonOk } from "../../../buzzer/readJson";

export const dynamic = "force-dynamic";

const POLL_TIMEOUT_MS = 20_000;

/**
 * Public long-poll (phones, TV, join screen). Without a token: names, photos,
 * who's still standing — never missions or targets. With a token: that
 * player's own target and mission on top. 410 = this phone's seat is gone.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let game = await getGameByCode(code);
  if (!game) return jsonError("Cette partie n'existe plus", 404);

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const since = Number(url.searchParams.get("v"));

  if (Number.isFinite(since) && since === game.version) {
    await waitForChange(game.id, POLL_TIMEOUT_MS, request.signal);
    game = await getGameByCode(code);
    if (!game) return jsonError("Cette partie n'existe plus", 404);
  }

  if (token) {
    const view = await getPlayerView(game, token);
    return view ? jsonOk(view) : jsonError("Place libérée", 410);
  }
  return jsonOk(await getPublicView(game));
}
