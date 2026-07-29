import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/core/db/client";
import { serverErrorLog } from "@/core/db/schema";

/**
 * Read-only view of the last server errors, protected by a shared secret
 * (same pattern as /api/cron) rather than member auth — there's no NAS
 * shell access, so this is how a crash on the NAS gets diagnosed from
 * anywhere, without asking whoever's near the machine to fetch a log.
 * Populated by src/instrumentation.ts's onRequestError.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.DIAGNOSTICS_SECRET;
  if (!secret || request.headers.get("x-diagnostics-secret") !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const rows = await db
    .select()
    .from(serverErrorLog)
    .orderBy(desc(serverErrorLog.occurredAt))
    .limit(50);

  return NextResponse.json(rows);
}
