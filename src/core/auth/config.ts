import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { logActivity } from "@/core/activity";
import { db } from "@/core/db/client";
import { account, member, session, user, verification } from "@/core/db/schema";
import { sendMail } from "@/core/mail/send";
import { MagicLinkEmail } from "@/core/mail/templates/MagicLinkEmail";
import { createNotification } from "@/core/notifications";
import { clubHasNoMembersYet, findValidInvitationByEmail, markInvitationAccepted } from "./invitations";

async function deliverMagicLink(email: string, url: string) {
  await sendMail({
    to: email,
    subject: "LE CLHUB — ton lien de connexion",
    react: MagicLinkEmail({ url }),
    devFallbackMessage: `Magic link for ${email}:\n${url}`,
  });
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.APP_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  plugins: [
    magicLink({
      expiresIn: 15 * 60, // 15 minutes
      sendMagicLink: async ({ email, url }) => {
        const normalizedEmail = email.toLowerCase().trim();

        // Gate account creation to invited addresses. Existing members
        // (who already have a user row) can always request a fresh link —
        // only brand-new emails need a live invitation, checked below.
        const existing = await db.query.user.findFirst({
          where: (u, { eq }) => eq(u.email, normalizedEmail),
        });

        if (!existing) {
          const invited = await findValidInvitationByEmail(normalizedEmail);
          const isBootstrap = await clubHasNoMembersYet();
          if (!invited && !isBootstrap) {
            // A plain Error thrown here gets swallowed by better-call's router
            // into a bodyless 500 (see better-call/dist/router.mjs) — the
            // client's `error.message` ends up undefined and nothing shows.
            // APIError's body survives the trip.
            throw new APIError("FORBIDDEN", { message: "T'es pas sur la liste." });
          }
        }

        await deliverMagicLink(normalizedEmail, url);
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        // Runs right after Better Auth creates the `user` row on first
        // successful magic-link click — this is where the invitation
        // becomes an actual club membership.
        after: async (createdUser) => {
          const invited = await findValidInvitationByEmail(createdUser.email);
          const inviter = invited
            ? await db.query.member.findFirst({
                where: (m, { eq }) => eq(m.id, invited.invitedById),
              })
            : null;

          const [newMember] = await db
            .insert(member)
            .values({ userId: createdUser.id, invitedById: inviter?.id ?? null })
            .returning();

          if (!newMember) {
            throw new Error("Failed to create member profile after user creation");
          }

          await logActivity({
            section: "club",
            kind: "member.joined",
            actorId: newMember.id,
            subjectRef: `member:${newMember.id}`,
            payload: { memberNumber: newMember.memberNumber, invitedByMemberId: inviter?.id ?? null },
          });

          if (invited) {
            await markInvitationAccepted(invited.id);
          }

          if (inviter) {
            await createNotification({
              memberId: inviter.id,
              kind: "invitation.accepted",
              entityRef: `member:${newMember.id}`,
              payload: { newMemberName: createdUser.name, newMemberNumber: newMember.memberNumber },
            });
          }
        },
      },
    },
  },
});
