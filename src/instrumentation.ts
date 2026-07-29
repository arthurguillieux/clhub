import { sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { serverErrorLog } from "@/core/db/schema";

// Rolling diagnostic window, not an audit log — old rows are trimmed on
// every insert so this never grows unbounded on its own.
const MAX_ROWS = 200;

interface RequestErrorContext {
  routeType?: string;
}

/**
 * Next's hook for every uncaught server-side error (Server Components,
 * Route Handlers, Server Actions) — see GET /api/diagnostics for how this
 * gets read back. Writing the error must never itself throw: this runs
 * while a request is already failing, and a second failure here would
 * just swallow the original error entirely.
 */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: RequestErrorContext,
): Promise<void> {
  try {
    const error = err as { message?: string; stack?: string; digest?: string } | undefined;

    await db.insert(serverErrorLog).values({
      path: request.path ?? null,
      method: request.method ?? null,
      routeType: context.routeType ?? null,
      message: error?.message ?? String(err),
      stack: error?.stack ?? null,
      digest: error?.digest ?? null,
    });

    await db.execute(sql`
      delete from server_error_log
      where id not in (
        select id from server_error_log order by occurred_at desc limit ${MAX_ROWS}
      )
    `);
  } catch {
    // See the doc comment above — deliberately silent.
  }
}
