"use server";

import { getSession } from "@/core/auth/session";
import { createInvitation } from "@/core/auth/invitations";
import { sendMail } from "@/core/mail/send";
import { InvitationEmail } from "@/core/mail/templates/InvitationEmail";

export type InviteFormState =
  | { status: "idle" }
  | { status: "success"; url: string }
  | { status: "error"; message: string };

export async function submitInvite(
  _prevState: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { status: "error", message: "Adresse mail invalide." };
  }

  const session = await getSession();
  if (!session) {
    return { status: "error", message: "Tu dois être connecté pour inviter quelqu'un." };
  }

  const { invitation, token } = await createInvitation(email, session.member.id);
  const url = `${process.env.APP_URL}/invitations/${token}`;

  await sendMail({
    to: invitation.email,
    subject: "LE CLHUB — tu es invité·e",
    react: InvitationEmail({ inviterName: session.user.name, url }),
    devFallbackMessage: `Invitation link for ${invitation.email}:\n${url}`,
  });

  return { status: "success", url };
}
