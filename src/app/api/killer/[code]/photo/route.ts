import sharp from "sharp";
import { getGameByCode, setPhoto } from "@/modules/killer/data/games";
import { jsonError, jsonOk } from "../../../buzzer/readJson";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

/**
 * The selfie taken at sign-up. Re-encoded server-side (square crop, 400 px,
 * WebP) whatever the phone sent — that also strips EXIF data such as location.
 * Stored in Postgres, not on disk: the NAS uploads folder has refused writes
 * before, and a missing avatar mid-party isn't an option.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const game = await getGameByCode(code);
  if (!game) return jsonError("Cette partie n'existe plus", 404);

  const token = new URL(request.url).searchParams.get("token");
  if (!token) return jsonError("Joueur inconnu", 410);

  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length === 0 || raw.length > MAX_UPLOAD_BYTES) return jsonError("Photo trop lourde ou vide", 400);

  let photo: Buffer;
  try {
    photo = await sharp(raw).rotate().resize(400, 400, { fit: "cover", position: "centre" }).webp({ quality: 78 }).toBuffer();
  } catch {
    return jsonError("Cette image n'a pas pu être lue", 400);
  }

  const result = await setPhoto(game, token, photo);
  return result.ok ? jsonOk({ ok: true }) : jsonError(result.error, 410);
}
