import { getRoom, hasTeam, longPoll } from "@/modules/jeux/data/buzzerRooms";
import { jsonError, jsonOk } from "../../readJson";

export const dynamic = "force-dynamic";

/**
 * Public on purpose (phones have no account): anyone holding the game's code
 * can read its team names and scores, which is what a phone shows anyway.
 * `token` is optional — the host screen polls without one.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return jsonError("Cette partie n'existe plus", 404);

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token && !hasTeam(room, token)) return jsonError("Équipe inconnue", 410);

  const since = Number(url.searchParams.get("v"));
  const view = await longPoll(room, token, Number.isFinite(since) ? since : -1, request.signal);
  return jsonOk(view);
}
