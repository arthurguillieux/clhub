import { z } from "zod";
import { claimSeat, getGameByCode } from "@/modules/killer/data/games";
import { jsonError, jsonOk, readJson } from "../../../buzzer/readJson";

export const dynamic = "force-dynamic";

const schema = z.object({ playerId: z.string().uuid() });

/** Public: a guest taps their name in the list the organizer prepared. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const game = await getGameByCode(code);
  if (!game) return jsonError("Cette partie n'existe plus", 404);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Demande invalide", 400);

  const result = await claimSeat(game, parsed.data.playerId);
  return result.ok ? jsonOk({ token: result.value }) : jsonError(result.error, 409);
}
