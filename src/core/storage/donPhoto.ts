import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { saveUpload } from "./index";

const MAX_WIDTH = 1200;

/** Same processing as saveItemPhoto — resized down (never up), stored as webp. One cover photo per listing, no gallery. */
export async function saveDonPhoto(listingId: string, fileBuffer: Buffer): Promise<string> {
  const resized = await sharp(fileBuffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  const filename = `${listingId}-${randomUUID()}.webp`;
  return saveUpload("dons", filename, resized);
}
