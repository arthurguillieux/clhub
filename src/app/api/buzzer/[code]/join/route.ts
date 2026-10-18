import { z } from "zod";
import { getRoom, joinRoom } from "@/modules/jeux/data/buzzerRooms";
import { jsonError, jsonOk, readJson } from "../../readJson";

export const dynamic = "force-dynamic";

const joinSchema = z.object({
  name: z.string().max(100),
  avatar: z.string().max(40).nullish(),
  token: z.string().max(64).nullish(),
});

/** Public: anyone who scanned the QR code can join, no account needed. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room || room.ended) return jsonError("Cette partie n'existe plus", 404);

  const parsed = joinSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Demande invalide", 400);

  const result = joinRoom(room, {
    name: parsed.data.name,
    avatarId: parsed.data.avatar ?? null,
    token: parsed.data.token ?? null,
  });
  if (!result.ok) return jsonError(result.error, 409);
  return jsonOk({ token: result.token, teamId: result.teamId });
}
