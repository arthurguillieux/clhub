import { getGameSound, setGameSound, type SoundKind } from "@/modules/killer/data/games";
import { checkKillerHost } from "@/modules/killer/host";
import { jsonError, jsonOk } from "../../../buzzer/readJson";

export const dynamic = "force-dynamic";

const MAX_SOUND_BYTES = 2 * 1024 * 1024;

/** Recognised by their first bytes, whatever the browser claims: mp3 (with or without ID3), wav, ogg, m4a. */
function audioType(data: Buffer): string | null {
  const ascii = (start: number, end: number) => data.subarray(start, end).toString("latin1");
  if (ascii(0, 3) === "ID3" || (data[0] === 0xff && (data[1]! & 0xe0) === 0xe0)) return "audio/mpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(4, 8) === "ftyp") return "audio/mp4";
  return null;
}

/** ?kind=countdown for the launch countdown's sound; the elimination sound otherwise. */
const kindOf = (request: Request): SoundKind => (new URL(request.url).searchParams.get("kind") === "countdown" ? "countdown" : "elimination");

/**
 * The organizer's own sounds (elimination, launch countdown). Only the organizer can send, remove or fetch it — the TV
 * runs in their browser, signed in — so a sound found online stays on the NAS, played at home,
 * and never ends up in the public repository or in front of guests' phones.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkKillerHost(code);
  if (!check.ok) return jsonError("Accès refusé", check.reason === "missing" ? 404 : 403);
  const sound = await getGameSound(check.game, kindOf(request));
  if (!sound) return jsonError("Pas de son personnalisé", 404);
  return new Response(new Uint8Array(sound.data), {
    headers: { "Content-Type": sound.type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkKillerHost(code);
  if (!check.ok) return jsonError("Accès refusé", check.reason === "missing" ? 404 : 403);

  const data = Buffer.from(await request.arrayBuffer());
  if (data.length === 0 || data.length > MAX_SOUND_BYTES) return jsonError("Le fichier est vide ou dépasse 2 Mo", 400);
  const type = audioType(data);
  if (!type) return jsonError("Ce fichier n'est pas un son lisible (mp3, wav, ogg ou m4a)", 400);

  await setGameSound(check.game, kindOf(request), { data, type });
  return jsonOk({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkKillerHost(code);
  if (!check.ok) return jsonError("Accès refusé", check.reason === "missing" ? 404 : 403);
  await setGameSound(check.game, kindOf(request), null);
  return jsonOk({ ok: true });
}
