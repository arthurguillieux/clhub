import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { saveUpload } from "./index";

const AVATAR_SIZE = 256;

/** Resizes to a square webp thumbnail and stores it — never trust the original upload's dimensions. */
export async function saveAvatar(memberId: string, fileBuffer: Buffer): Promise<string> {
  const resized = await sharp(fileBuffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();

  const filename = `${memberId}-${randomUUID()}.webp`;
  return saveUpload("avatars", filename, resized);
}
