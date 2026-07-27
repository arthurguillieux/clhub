import { count, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import {
  member,
  user,
  item,
  booking,
  itemComment,
  maintenanceLog,
  waitlistEntry,
  wantedPost,
  wantedInterest,
  project,
  actionToken,
  memberAchievement,
  menuEvent,
  menuResponse,
  caisseTransaction,
  recipe,
  notification,
  activity,
  invitation,
} from "@/core/db/schema";
import { createInvitation } from "@/core/auth/invitations";
import { sendMail } from "@/core/mail/send";
import { InvitationEmail } from "@/core/mail/templates/InvitationEmail";
import { deleteItemsOwnedByMember } from "./items";

export interface AdminMemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  memberNumber: number | null;
  role: string;
  joinedAt: Date;
}

export async function listAllMembersForAdmin(): Promise<AdminMemberRow[]> {
  const rows = await db
    .select({
      id: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      image: user.image,
      memberNumber: member.memberNumber,
      role: member.role,
      joinedAt: member.joinedAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .orderBy(member.memberNumber);

  return rows;
}

export async function setMemberRole(memberId: string, role: "member" | "admin"): Promise<void> {
  await db.update(member).set({ role, updatedAt: new Date() }).where(eq(member.id, memberId));
}

/** Reuses the same invitation + mail machinery as the member-facing /invite page. */
export async function inviteMemberByEmail(adminMemberId: string, adminName: string, email: string): Promise<void> {
  const { invitation: created, token } = await createInvitation(email, adminMemberId);
  const url = `${process.env.APP_URL}/invitations/${token}`;
  await sendMail({
    to: created.email,
    subject: "LE CLHUB — tu es invité·e",
    react: InvitationEmail({ inviterName: adminName, url }),
    devFallbackMessage: `Invitation link for ${created.email}:\n${url}`,
  });
}

export interface MemberDeletionImpact {
  itemsOwned: number;
  bookingsAsBorrower: number;
  wantedPosts: number;
  projects: number;
  menuEvents: number;
  caisseTransactions: number;
  recipes: number;
  activityEntries: number;
  notifications: number;
  invitationsSent: number;
}

async function countRows(n: Promise<{ n: number }[]>): Promise<number> {
  const [row] = await n;
  return row?.n ?? 0;
}

/** Shown to the admin before they confirm — a delete this wide deserves to say what it's about to touch. */
export async function getMemberDeletionImpact(memberId: string): Promise<MemberDeletionImpact> {
  const [
    itemsOwned,
    bookingsAsBorrower,
    wantedPosts,
    projects,
    menuEvents,
    caisseTransactions,
    recipes,
    activityEntries,
    notifications,
    invitationsSent,
  ] = await Promise.all([
    countRows(db.select({ n: count() }).from(item).where(eq(item.ownerId, memberId))),
    countRows(db.select({ n: count() }).from(booking).where(eq(booking.borrowerId, memberId))),
    countRows(db.select({ n: count() }).from(wantedPost).where(eq(wantedPost.requesterId, memberId))),
    countRows(db.select({ n: count() }).from(project).where(eq(project.requesterId, memberId))),
    countRows(db.select({ n: count() }).from(menuEvent).where(eq(menuEvent.createdById, memberId))),
    countRows(db.select({ n: count() }).from(caisseTransaction).where(eq(caisseTransaction.memberId, memberId))),
    countRows(db.select({ n: count() }).from(recipe).where(eq(recipe.createdById, memberId))),
    countRows(db.select({ n: count() }).from(activity).where(eq(activity.actorId, memberId))),
    countRows(db.select({ n: count() }).from(notification).where(eq(notification.memberId, memberId))),
    countRows(db.select({ n: count() }).from(invitation).where(eq(invitation.invitedById, memberId))),
  ]);

  return {
    itemsOwned,
    bookingsAsBorrower,
    wantedPosts,
    projects,
    menuEvents,
    caisseTransactions,
    recipes,
    activityEntries,
    notifications,
    invitationsSent,
  };
}

/**
 * Full wipe: every row this member touches, anywhere. Items they own are
 * deleted with all their dependents (see modules/admin/data/items.ts) —
 * an owner-less item makes no sense in this app's model, so "delete the
 * member" means "delete what's theirs", not "orphan it". Other members
 * they invited are preserved; only the parrainage pointer is cleared.
 * Runs as one transaction — a table this function doesn't yet know about
 * fails the whole delete with a clear FK error instead of leaving the
 * club half-deleted.
 */
export async function deleteMemberCascade(memberId: string): Promise<void> {
  const [target] = await db.select({ userId: member.userId }).from(member).where(eq(member.id, memberId));
  if (!target) return;

  await db.transaction(async (tx) => {
    await deleteItemsOwnedByMember(tx, memberId);

    await tx.delete(booking).where(eq(booking.borrowerId, memberId));
    await tx
      .update(booking)
      .set({ respondedBy: null })
      .where(eq(booking.respondedBy, memberId));

    await tx.delete(itemComment).where(eq(itemComment.authorId, memberId));
    await tx.delete(maintenanceLog).where(eq(maintenanceLog.authorId, memberId));
    await tx.delete(waitlistEntry).where(eq(waitlistEntry.memberId, memberId));

    await tx.delete(wantedInterest).where(eq(wantedInterest.memberId, memberId));
    const ownPosts = await tx
      .select({ id: wantedPost.id })
      .from(wantedPost)
      .where(eq(wantedPost.requesterId, memberId));
    for (const p of ownPosts) {
      await tx.delete(wantedInterest).where(eq(wantedInterest.wantedPostId, p.id));
    }
    await tx.delete(wantedPost).where(eq(wantedPost.requesterId, memberId));

    await tx.delete(project).where(eq(project.requesterId, memberId));
    await tx.delete(actionToken).where(eq(actionToken.memberId, memberId));
    await tx.delete(memberAchievement).where(eq(memberAchievement.memberId, memberId));

    await tx.delete(menuResponse).where(eq(menuResponse.memberId, memberId));
    const ownEvents = await tx
      .select({ id: menuEvent.id })
      .from(menuEvent)
      .where(eq(menuEvent.createdById, memberId));
    for (const e of ownEvents) {
      await tx.delete(menuResponse).where(eq(menuResponse.eventId, e.id));
    }
    await tx.delete(menuEvent).where(eq(menuEvent.createdById, memberId));

    await tx.delete(caisseTransaction).where(eq(caisseTransaction.memberId, memberId));
    await tx.delete(recipe).where(eq(recipe.createdById, memberId));
    await tx.delete(notification).where(eq(notification.memberId, memberId));
    await tx.delete(activity).where(eq(activity.actorId, memberId));
    await tx.delete(invitation).where(eq(invitation.invitedById, memberId));

    await tx.update(member).set({ invitedById: null }).where(eq(member.invitedById, memberId));

    // Cascades to member/account/session (onDelete: "cascade" on each).
    await tx.delete(user).where(eq(user.id, target.userId));
  });
}
