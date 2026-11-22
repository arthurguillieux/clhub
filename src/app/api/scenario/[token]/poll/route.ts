import { waitForChange } from "@/modules/killer/data/notifier";
import { getByToken, getProjectionView } from "@/modules/loups/scenarios/data";
import { scenarioOf } from "@/modules/loups/scenarios";
import { jsonError, jsonOk } from "../../../buzzer/readJson";

export const dynamic = "force-dynamic";

const POLL_TIMEOUT_MS = 20_000;

/**
 * The projection's long-poll: the request waits until the evening changes (a gesture on the console),
 * then answers with what the room may see. Same plumbing as the Killer's TV.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let game = await getByToken(token);
  const def = game ? scenarioOf(game.scenarioId) : null;
  if (!game || !def) return jsonError("Cette soirée n'existe plus", 404);
  const since = Number(new URL(request.url).searchParams.get("v"));
  if (Number.isFinite(since) && since === game.version) {
    await waitForChange(game.id, POLL_TIMEOUT_MS, request.signal);
    game = await getByToken(token);
    if (!game) return jsonError("Cette soirée n'existe plus", 404);
  }
  return jsonOk(await getProjectionView(game, def));
}
