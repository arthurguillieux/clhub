import { getGameByCode, getHostView } from "@/modules/killer/data/games";
import { waitForChange } from "@/modules/killer/data/notifier";
import { checkKillerHost } from "@/modules/killer/host";
import { jsonError, jsonOk } from "../../../buzzer/readJson";

export const dynamic = "force-dynamic";

/** The organizer's long-poll: everything, missions and circle included — so it checks who's asking. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkKillerHost(code);
  if (!check.ok) return jsonError("Accès refusé", check.reason === "missing" ? 404 : 403);

  let game = check.game;
  const since = Number(new URL(request.url).searchParams.get("v"));
  if (Number.isFinite(since) && since === game.version) {
    await waitForChange(game.id, 20_000, request.signal);
    const fresh = await getGameByCode(code);
    if (!fresh) return jsonError("Cette partie n'existe plus", 404);
    game = fresh;
  }
  return jsonOk(await getHostView(game));
}
