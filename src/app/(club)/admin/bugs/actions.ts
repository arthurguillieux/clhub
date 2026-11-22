"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/admin";
import { BUG_STATUSES, deleteBugReports, forClaude, listBugReports, recentServerErrors, setBugStatus } from "@/modules/bugs/data";

const id = z.string().uuid();

/** Arthur's verdict on a report: bug, not a bug, fixed, with a word if he wants. */
export async function bugStatusAction(input: unknown): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsed = z.object({ id, status: z.enum(BUG_STATUSES), note: z.string().trim().max(1000).nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  await setBugStatus(parsed.data.id, parsed.data.status, parsed.data.note || null);
  revalidatePath("/admin/bugs");
  return { ok: true };
}

export async function deleteBugAction(bugId: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsed = id.safeParse(bugId);
  if (!parsed.success) return { ok: false };
  await deleteBugReports([parsed.data]);
  revalidatePath("/admin/bugs");
  return { ok: true };
}

/** The open reports and the server's last errors, as Markdown to paste to Claude. */
export async function claudeSummaryAction(): Promise<string> {
  await requireAdmin();
  const [reports, errors] = await Promise.all([listBugReports(), recentServerErrors()]);
  return forClaude(reports, errors);
}
