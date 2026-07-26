import { NextResponse } from "next/server";
import { runScheduledTasks } from "@/modules/pretotheque/data/scheduledTasks";

/**
 * Called by DSM Task Scheduler (curl, nightly) instead of a dedicated worker
 * container — see docs/04-exploitation.md §7 for the exact cron entry.
 * Protected by a shared secret since there's no interactive login here.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const summary = await runScheduledTasks();
  return NextResponse.json(summary);
}
