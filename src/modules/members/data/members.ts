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
