import { asc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { member, user } from "@/core/db/schema";

export interface MemberSummary {
  id: string;
  name: string;
  image: string | null;
  memberNumber: number | null;
}

export interface MemberProfile extends MemberSummary {
  bio: string | null;
  joinedAt: Date;
}

/** Every member, for the /membres directory — ordered by member number, i.e. join order. */
export async function listMembers(): Promise<MemberSummary[]> {
  return db
    .select({ id: member.id, name: user.name, image: user.image, memberNumber: member.memberNumber })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .orderBy(asc(member.memberNumber));
}

/** A single member's public-facing profile — bio and join date, never phone/calendar (settings-only). */
export async function getMemberProfile(memberId: string): Promise<MemberProfile | null> {
  const [row] = await db
    .select({
      id: member.id,
      name: user.name,
      image: user.image,
      memberNumber: member.memberNumber,
      bio: member.bio,
      joinedAt: member.joinedAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.id, memberId))
    .limit(1);

  return row ?? null;
}

export interface MemberProfileEditable {
  id: string;
  name: string;
  bio: string | null;
  phone: string | null;
  householdSize: number;
}

/** Admin-only surface (see /membres/[id] and adminUpdateMemberProfileAction) — phone/householdSize deliberately never reach the plain getMemberProfile above. */
export async function getMemberProfileForEdit(memberId: string): Promise<MemberProfileEditable | null> {
  const [row] = await db
    .select({
      id: member.id,
      name: user.name,
      bio: member.bio,
      phone: member.phone,
      householdSize: member.householdSize,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.id, memberId))
    .limit(1);

  return row ?? null;
}

export interface AdminMemberProfileInput {
  name: string;
  bio: string | null;
  phone: string | null;
  householdSize: number;
}

/** Unlike updateProfile (settings/actions.ts), this targets an arbitrary member — auth.api.updateUser is session-bound, so name goes through a direct update instead. */
export async function adminUpdateMemberProfile(memberId: string, input: AdminMemberProfileInput): Promise<void> {
  const target = await db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, memberId) });
  if (!target) throw new Error("Member not found");

  await db.update(user).set({ name: input.name }).where(eq(user.id, target.userId));
  await db
    .update(member)
    .set({ bio: input.bio, phone: input.phone, householdSize: input.householdSize, updatedAt: new Date() })
    .where(eq(member.id, memberId));
}
