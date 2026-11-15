import { NextResponse } from "next/server";
import { readImage } from "@/modules/lettre/data/images";

/**
 * The pictures of a letter (the child, the gifts, the thank-you): only for whoever has the family's
 * link, never under a public address. An id never changes content, so the browser keeps it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }): Promise<NextResponse> {
  const { token, id } = await params;
  if (!/^[\w-]{16,64}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const data = await readImage(token, id);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
