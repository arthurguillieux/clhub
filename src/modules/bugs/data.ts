import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db/client";
import { bugReport, member, serverErrorLog, user } from "@/core/db/schema";
import { sendMail } from "@/core/mail/send";
import { BugReportEmail } from "@/core/mail/templates/BugReportEmail";
import { createNotification } from "@/core/notifications";


import type { BugStatus } from "./labels";

export { BUG_STATUSES, BUG_STATUS_LABELS, type BugStatus } from "./labels";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** A member's report: saved, then every admin hears of it (notification and mail). Never fails because of the mail. */
export async function reportBug(memberId: string, input: { page: string | null; message: string; userAgent: string | null }): Promise<void> {
  const [row] = await db.insert(bugReport).values({ memberId, page: input.page, message: input.message, userAgent: input.userAgent }).returning({ id: bugReport.id });
  if (!row) return;
  try {
    const [who] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, memberId)).limit(1);
    const admins = await db.select({ id: member.id, email: user.email }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.role, "admin"));
    for (const admin of admins) {
      await createNotification({ memberId: admin.id, kind: "bug.report", entityRef: `bug:${row.id}`, payload: { name: who?.name ?? "Un membre", page: input.page, excerpt: input.message.slice(0, 120) } });
      if (!admin.email) continue;
      try {
        await sendMail({
          to: admin.email,
          subject: `🐞 Signalement de ${who?.name ?? "un membre"}`,
          react: BugReportEmail({ who: who?.name ?? "Un membre", page: input.page, message: input.message, link: `${appUrl()}/admin/bugs` }),
          devFallbackMessage: `bug report from ${who?.name}: ${input.message.slice(0, 80)}`,
        });
      } catch (error) {
        console.error("Bug report mail failed", error);
      }
    }
  } catch (error) {
    console.error("Bug report notification failed", error);
  }
}

export async function listBugReports() {
  return db
    .select({ id: bugReport.id, page: bugReport.page, message: bugReport.message, userAgent: bugReport.userAgent, status: bugReport.status, note: bugReport.note, createdAt: bugReport.createdAt, name: user.name })
    .from(bugReport)
    .leftJoin(member, eq(member.id, bugReport.memberId))
    .leftJoin(user, eq(user.id, member.userId))
    .orderBy(desc(bugReport.createdAt))
    .limit(200);
}

export async function setBugStatus(id: string, status: BugStatus, note: string | null): Promise<void> {
  await db.update(bugReport).set({ status, note }).where(eq(bugReport.id, id));
}

export async function deleteBugReports(ids: string[]): Promise<void> {
  if (ids.length) await db.delete(bugReport).where(inArray(bugReport.id, ids));
}

/** The server's own last errors (src/instrumentation.ts): what a « pas de connexion » hides. */
export async function recentServerErrors(limit = 30) {
  return db
    .select({ id: serverErrorLog.id, path: serverErrorLog.path, method: serverErrorLog.method, routeType: serverErrorLog.routeType, message: serverErrorLog.message, stack: serverErrorLog.stack, occurredAt: serverErrorLog.occurredAt })
    .from(serverErrorLog)
    .orderBy(desc(serverErrorLog.occurredAt))
    .limit(limit);
}

export { forClaude } from "./summary";
