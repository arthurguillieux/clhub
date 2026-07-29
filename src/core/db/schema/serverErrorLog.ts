import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Populated by src/instrumentation.ts's onRequestError hook, read by
 * GET /api/diagnostics (core/auth's usual member/session model doesn't
 * apply here — see that route for why). Exists so a server-side crash on
 * the NAS is checkable over HTTPS from anywhere, not just by someone
 * physically able to open Container Manager's log viewer.
 */
export const serverErrorLog = pgTable("server_error_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  path: text("path"),
  method: text("method"),
  routeType: text("route_type"), // e.g. 'render', 'route', 'action' — from Next's error context
  message: text("message").notNull(),
  stack: text("stack"),
  digest: text("digest"), // Next's per-error id, shown to the user on the generic error page
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ServerErrorLog = typeof serverErrorLog.$inferSelect;
export type NewServerErrorLog = typeof serverErrorLog.$inferInsert;
