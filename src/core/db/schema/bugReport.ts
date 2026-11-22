import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { member } from "./member";

/**
 * « Signaler un bug »: what a member saw go wrong, where, and when. The admins hear of it (mail and
 * notification) and sort it out with Arthur: `status` is new, bug, notabug (not a bug: an idea, a
 * misunderstanding…) or fixed. Copied for Claude from /admin/bugs.
 */
export const bugReport = pgTable("bug_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").references(() => member.id, { onDelete: "set null" }),
  /** The page they were on (path only). */
  page: text("page"),
  message: text("message").notNull(),
  /** The browser, to reproduce: phone or computer, which one. */
  userAgent: text("user_agent"),
  status: text("status").notNull().default("new"),
  /** Arthur's word on it. */
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BugReport = typeof bugReport.$inferSelect;
