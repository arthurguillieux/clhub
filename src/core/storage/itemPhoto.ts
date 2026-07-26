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

export interface SavedItemPhoto {
  path: string;
  width: number | null;
  height: number | null;
}

/** Same processing as saveItemPhoto, plus the resulting dimensions for item_photo. */
export async function saveItemGalleryPhoto(
  itemId: string,
  fileBuffer: Buffer,
): Promise<SavedItemPhoto> {
  const resized = sharp(fileBuffer).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 85 });
  const { data, info } = await resized.toBuffer({ resolveWithObject: true });

  const filename = `${itemId}-${randomUUID()}.webp`;
  const path = await saveUpload("items", filename, data);
  return { path, width: info.width ?? null, height: info.height ?? null };
}
