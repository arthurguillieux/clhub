import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Files live under public/uploads so Next's own static file serving covers
 * them — no custom route needed. In production, the NAS mounts a persistent
 * volume at exactly this path (see docker/compose.yaml) so uploads survive
 * redeploys even though public/ itself is baked into the image at build time.
 */
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

/** Saves a file under public/uploads/<subdir>/<filename> and returns its public URL. */
export async function saveUpload(subdir: string, filename: string, data: Buffer): Promise<string> {
  const dir = path.join(UPLOADS_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), data);
  return `/uploads/${subdir}/${filename}`;
}
