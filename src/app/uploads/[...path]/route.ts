import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Serves core/storage's uploads (avatar/item photos) explicitly, rather
 * than relying on Next's built-in public/ passthrough. That passthrough
 * only knows about files present in public/ when the image was built —
 * confirmed live: `next build` bakes a snapshot, so anything an upload
 * writes into the volume-mounted public/uploads afterward is 404 even
 * though it's genuinely sitting on disk. See core/storage/index.ts for
 * where files actually land; this just needs to agree with it.
 */
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: segments } = await params;
  const resolved = path.join(UPLOADS_ROOT, ...segments);

  // Defense in depth against a crafted path segment reaching outside
  // uploads/ — Next's own [...path] segmentation shouldn't allow a literal
  // ".." to survive, but this doesn't rely on that being true forever.
  if (!resolved.startsWith(UPLOADS_ROOT)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const info = await stat(resolved);
    if (!info.isFile()) throw new Error("not a file");

    const data = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();

    return new NextResponse(data, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        // Filenames embed a random UUID, so a given URL's content never
        // changes — safe to cache aggressively.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
