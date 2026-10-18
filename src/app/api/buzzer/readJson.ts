import { NextResponse } from "next/server";

const MAX_BODY_BYTES = 2_000;

/** Small JSON bodies only — these endpoints are public, so nothing big gets read. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return null;
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

export const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export const jsonOk = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
