import sharp from "sharp";
import { buildZip } from "@/core/zip";
import { getAllPhotos } from "@/modules/killer/data/games";
import { checkKillerHost } from "@/modules/killer/host";
import { jsonError } from "../../../buzzer/readJson";

export const dynamic = "force-dynamic";

/** A file name that works on every system: the player's name, without the characters filesystems refuse. */
const safeName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim() || "joueur";

/**
 * Every player's photo in one .zip, for the organizers to send them out after the game. As JPEG
 * (they're stored as WebP), which every phone, computer and messaging app opens. Organizers only.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkKillerHost(code);
  if (!check.ok) return jsonError("Accès refusé", check.reason === "missing" ? 404 : 403);

  const photos = await getAllPhotos(check.game);
  if (photos.length === 0) return jsonError("Aucune photo pour cette partie", 404);

  const used = new Map<string, number>();
  const files = await Promise.all(
    photos.map(async ({ name, photo }) => {
      const base = safeName(name);
      const n = (used.get(base) ?? 0) + 1;
      used.set(base, n);
      return { name: `${n > 1 ? `${base} (${n})` : base}.jpg`, data: await sharp(photo).jpeg({ quality: 92 }).toBuffer() };
    }),
  );
  const zip = buildZip(files);
  const fileName = `Photos ${safeName(check.game.title)}.zip`;
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="photos-killer-${check.game.code}.zip"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
