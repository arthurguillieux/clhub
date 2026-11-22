"use server";

import { revalidatePath } from "next/cache";
import { isAdminModeActive } from "@/core/auth/admin";
import { getSession } from "@/core/auth/session";
import { resendInvitation, sendInvitation } from "@/modules/invitations/data";

export type InviteFormState =
  | { status: "idle" }
  | { status: "success"; email: string }
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

  const sent = await sendInvitation(session.member.id, session.user.name, email);
  if (!sent.ok) return { status: "error", message: sent.error };
  revalidatePath("/invite");
  revalidatePath("/admin/membres");
  return { status: "success", email: email.toLowerCase().trim() };
}

/** « Renvoyer l'invitation »: a new link to an address that hasn't joined yet. */
export async function resendInvitationAction(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Tu dois être connecté." };
  const done = await resendInvitation(session.member.id, session.user.name, email, await isAdminModeActive());
  if (done.ok) {
    revalidatePath("/invite");
    revalidatePath("/admin/membres");
  }
  return done;
}
