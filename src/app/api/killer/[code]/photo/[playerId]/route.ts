import { getGameByCode, getPhoto } from "@/modules/killer/data/games";

export const dynamic = "force-dynamic";

/** Served by id + ?v=photoVersion, so a URL never changes content and can be cached for the evening. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string; playerId: string }> }) {
  const { code, playerId } = await params;
  const game = await getGameByCode(code);
  if (!game || !/^[0-9a-f-]{36}$/.test(playerId)) return new Response("Introuvable", { status: 404 });

  const photo = await getPhoto(game, playerId);
  if (!photo) return new Response("Introuvable", { status: 404 });

  return new Response(new Uint8Array(photo), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=86400" },
  });
}
