"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { unlockAdmin, requireAdmin, lockAdmin } from "@/core/auth/admin";
import { getSession } from "@/core/auth/session";
import {
  deleteMemberCascade,
  inviteMemberByEmail,
  setMemberRole,
} from "@/modules/admin/data/members";
import { deleteItemCascade, reassignItemOwner } from "@/modules/admin/data/items";

export type UnlockAdminState = { status: "idle" } | { status: "error"; message: string };

export async function unlockAdminAction(
  _prevState: UnlockAdminState,
  formData: FormData,
): Promise<UnlockAdminState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };
  if (session.member.role !== "admin") {
    // Same message as a wrong code — no reason to tell a non-admin which
    // check failed.
    return { status: "error", message: "Code incorrect." };
  }

  const code = formData.get("code");
  if (typeof code !== "string" || code.length === 0) {
    return { status: "error", message: "Code incorrect." };
  }

  const ok = await unlockAdmin(code);
  if (!ok) return { status: "error", message: "Code incorrect." };

  redirect("/admin");
}

export type InviteState = { status: "idle" } | { status: "success" } | { status: "error"; message: string };

export async function adminInviteAction(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const session = await requireAdmin();

  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { status: "error", message: "Adresse mail invalide." };
  }

  await inviteMemberByEmail(session.member.id, session.user.name, email);
  revalidatePath("/admin/membres");
  return { status: "success" };
}

export async function adminSetRoleAction(memberId: string, role: "member" | "admin"): Promise<void> {
  await requireAdmin();
  await setMemberRole(memberId, role);
  revalidatePath("/admin/membres");
}

export async function adminDeleteMemberAction(memberId: string): Promise<void> {
  const session = await requireAdmin();
  if (session.member.id === memberId) {
    throw new Error("Impossible de se supprimer soi-même depuis l'admin.");
  }
  await deleteMemberCascade(memberId);
  revalidatePath("/admin/membres");
  revalidatePath("/membres");
  revalidatePath("/");
}

export async function adminDeleteItemAction(itemId: string): Promise<void> {
  await requireAdmin();
  await deleteItemCascade(itemId);
  revalidatePath("/admin/objets");
  revalidatePath("/pretotheque");
}

export async function adminReassignItemAction(itemId: string, newOwnerId: string): Promise<void> {
  await requireAdmin();
  await reassignItemOwner(itemId, newOwnerId);
  revalidatePath("/admin/objets");
  revalidatePath("/pretotheque");
}

/** Ends admin mode early, from the site-wide banner — see AdminModeBanner.tsx. */
export async function lockAdminAction(): Promise<void> {
  await lockAdmin();
}
