import { getSession } from "@/core/auth/session";
import type { Letter } from "@/core/db/schema";
import { getLetterByCode, isCohost } from "./data/letters";

export type OrganizerCheck =
  | { ok: true; letter: Letter; memberId: string; role: "host" | "cohost" }
  | { ok: false; reason: "signed-out" | "missing" | "not-organizer" };

/** The organizers' page and actions: signed in, and the letter is theirs, created by them or shared with them. No admin bypass. */
export async function checkOrganizer(code: string): Promise<OrganizerCheck> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed-out" };
  const found = await getLetterByCode(code);
  if (!found) return { ok: false, reason: "missing" };
  return roleOf(found, session.member.id);
}

/** The same check once the letter is known, from its family link: an organizer may look before it's sent. */
export async function organizerOf(found: Letter): Promise<boolean> {
  const session = await getSession();
  return !!session && (await roleOf(found, session.member.id)).ok;
}

async function roleOf(found: Letter, memberId: string): Promise<OrganizerCheck> {
  if (found.hostMemberId === memberId) return { ok: true, letter: found, memberId, role: "host" };
  if (await isCohost(found, memberId)) return { ok: true, letter: found, memberId, role: "cohost" };
  return { ok: false, reason: "not-organizer" };
}
