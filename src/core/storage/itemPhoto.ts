import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { saveUpload } from "./index";

const MAX_WIDTH = 1200;

/** Resizes down to a max width (never up, never cropped) and stores as webp. */
export async function saveItemPhoto(itemId: string, fileBuffer: Buffer): Promise<string> {
  const resized = await sharp(fileBuffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  const filename = `${itemId}-${randomUUID()}.webp`;
  return saveUpload("items", filename, resized);
}
