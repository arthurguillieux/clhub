import { z } from "zod";
import { buzzRoom, getRoom } from "@/modules/jeux/data/buzzerRooms";
import { jsonError, jsonOk, readJson } from "../../readJson";

export const dynamic = "force-dynamic";

const buzzSchema = z.object({ token: z.string().max(64) });

/**
 * Phones always send the buzz and let the server decide whether the buzzers
 * are open — so a phone whose screen lags behind the room still gets its
 * buzz counted if it was in time.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return jsonError("Cette partie n'existe plus", 404);

  const parsed = buzzSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Demande invalide", 400);

  const outcome = buzzRoom(room, parsed.data.token);
  if (outcome === "unknown-team") return jsonError("Équipe inconnue", 410);
  return jsonOk({ ok: outcome === "buzzed" });
}
