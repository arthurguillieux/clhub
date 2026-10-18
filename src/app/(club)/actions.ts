"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/core/auth/session";
import { markAllNotificationsRead } from "@/core/notifications";

/** Nothing used to mark notifications as read, so the unread dot never went away — this is the explicit « Tout marquer comme lu ». */
export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  await markAllNotificationsRead(session.member.id);
  revalidatePath("/");
}
