import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { member, user, wantedInterest, wantedPost, type WantedPost } from "@/core/db/schema";
import { createNotification } from "@/core/notifications";
import { logActivity } from "@/core/activity";

/** Once this many members are interested, it's worth asking "on l'achète ensemble ?" */
const GROUP_BUY_THRESHOLD = 3;

export interface WantedPostWithDetails extends WantedPost {
  requesterName: string;
  interestCount: number;
  interestedMemberIds: string[];
}

export async function listOpenWantedPosts(): Promise<WantedPostWithDetails[]> {
  const posts = await db
    .select({ wantedPost, requesterName: user.name })
    .from(wantedPost)
    .innerJoin(member, eq(member.id, wantedPost.requesterId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(wantedPost.status, "open"))
    .orderBy(desc(wantedPost.createdAt));

  const interests = await db.select().from(wantedInterest);
  const interestsByPost = new Map<string, string[]>();
  for (const i of interests) {
    const list = interestsByPost.get(i.wantedPostId) ?? [];
    list.push(i.memberId);
    interestsByPost.set(i.wantedPostId, list);
  }

  return posts.map((row) => {
    const interested = interestsByPost.get(row.wantedPost.id) ?? [];
    return {
      ...row.wantedPost,
      requesterName: row.requesterName,
      interestCount: interested.length,
      interestedMemberIds: interested,
    };
  });
}

export async function createWantedPost(
  requesterId: string,
  input: { title: string; description: string | null; neededBy: string | null },
): Promise<WantedPost> {
  const [created] = await db.insert(wantedPost).values({ requesterId, ...input }).returning();
  if (!created) throw new Error("Failed to create wanted post");

  await logActivity({
    section: "pretotheque",
    kind: "wanted.posted",
    actorId: requesterId,
    subjectRef: `wanted:${created.id}`,
    payload: { title: created.title },
  });

  return created;
}

export type ExpressInterestResult =
  | { ok: true; groupBuyTriggered: boolean }
  | { ok: false; reason: "not-found" | "closed" | "own-post" };

export async function expressInterest(
  wantedPostId: string,
  memberId: string,
): Promise<ExpressInterestResult> {
  const post = await db.query.wantedPost.findFirst({ where: (w, { eq }) => eq(w.id, wantedPostId) });
  if (!post) return { ok: false, reason: "not-found" };
  if (post.status !== "open") return { ok: false, reason: "closed" };
  if (post.requesterId === memberId) return { ok: false, reason: "own-post" };

  await db
    .insert(wantedInterest)
    .values({ wantedPostId, memberId })
    .onConflictDoNothing();

  const countRows = await db
    .select({ value: count() })
    .from(wantedInterest)
    .where(eq(wantedInterest.wantedPostId, wantedPostId));
  const interestCount = countRows[0]?.value ?? 0;

  const shouldTrigger = interestCount >= GROUP_BUY_THRESHOLD && !post.groupBuyTriggeredAt;
  if (shouldTrigger) {
    await db
      .update(wantedPost)
      .set({ groupBuyTriggeredAt: new Date() })
      .where(eq(wantedPost.id, wantedPostId));

    const interested = await db
      .select({ memberId: wantedInterest.memberId })
      .from(wantedInterest)
      .where(eq(wantedInterest.wantedPostId, wantedPostId));
    const recipientIds = new Set([...interested.map((i) => i.memberId), post.requesterId]);

    await Promise.all(
      [...recipientIds].map((recipientId) =>
        createNotification({
          memberId: recipientId,
          kind: "wanted.group-buy",
          entityRef: `wanted:${wantedPostId}`,
          payload: { title: post.title, interestCount },
        }),
      ),
    );
  }

  return { ok: true, groupBuyTriggered: shouldTrigger };
}

export async function withdrawInterest(wantedPostId: string, memberId: string): Promise<void> {
  await db
    .delete(wantedInterest)
    .where(and(eq(wantedInterest.wantedPostId, wantedPostId), eq(wantedInterest.memberId, memberId)));
}

export type CloseWantedPostResult = { ok: true } | { ok: false; reason: "not-found" | "forbidden" };

export async function closeWantedPost(
  wantedPostId: string,
  requesterId: string,
): Promise<CloseWantedPostResult> {
  const post = await db.query.wantedPost.findFirst({ where: (w, { eq }) => eq(w.id, wantedPostId) });
  if (!post) return { ok: false, reason: "not-found" };
  if (post.requesterId !== requesterId) return { ok: false, reason: "forbidden" };

  await db.update(wantedPost).set({ status: "closed" }).where(eq(wantedPost.id, wantedPostId));
  return { ok: true };
}
