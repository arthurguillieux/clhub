"use server";

import { redirect } from "next/navigation";
import { unlockAdmin } from "@/core/auth/admin";
import { getSession } from "@/core/auth/session";

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
