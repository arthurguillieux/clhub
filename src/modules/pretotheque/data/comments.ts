import { asc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { itemComment, member, user, type ItemComment } from "@/core/db/schema";

export interface ItemCommentWithAuthor extends ItemComment {
  authorName: string;
}

/** Oldest first, like a conversation thread under the fiche. */
export async function listCommentsForItem(itemId: string): Promise<ItemCommentWithAuthor[]> {
  const rows = await db
    .select({ itemComment, authorName: user.name })
    .from(itemComment)
    .innerJoin(member, eq(member.id, itemComment.authorId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(itemComment.itemId, itemId))
    .orderBy(asc(itemComment.createdAt));

  return rows.map((r) => ({ ...r.itemComment, authorName: r.authorName }));
}

export async function addComment(
  itemId: string,
  authorId: string,
  body: string,
): Promise<ItemComment> {
  const [created] = await db.insert(itemComment).values({ itemId, authorId, body }).returning();
  if (!created) {
    throw new Error("Failed to create comment");
  }
  return created;
}
