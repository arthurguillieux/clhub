import { getSession } from "@/core/auth/session";
import type { SantaEvent } from "@/core/db/schema";
import { getEventByCode, isCohost } from "./data/events";

export type OrganizerCheck =
  | { ok: true; event: SantaEvent; memberId: string; role: "host" | "cohost" }
  | { ok: false; reason: "signed-out" | "missing" | "not-organizer" };

/**
 * The organizer's pages and actions: signed in, and the event must be theirs — created by them or
 * shared with them. Club admins get no bypass: they may well be taking part.
 */
export async function checkOrganizer(code: string): Promise<OrganizerCheck> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed-out" };
  const event = await getEventByCode(code);
  if (!event) return { ok: false, reason: "missing" };
  if (event.hostMemberId === session.member.id) return { ok: true, event, memberId: session.member.id, role: "host" };
  if (await isCohost(event, session.member.id)) return { ok: true, event, memberId: session.member.id, role: "cohost" };
  return { ok: false, reason: "not-organizer" };
}
