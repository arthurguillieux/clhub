"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/core/auth/config";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/db/client";
import { member } from "@/core/db/schema";
import { saveAvatar } from "@/core/storage/avatar";

export async function uploadAvatar(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not signed in");
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await saveAvatar(session.member.id, buffer);

  await auth.api.updateUser({ body: { image: url }, headers: await headers() });

  revalidatePath("/");
  revalidatePath("/settings");
}

export type ProfileFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", message: "Tu dois être connecté." };
  }

  const bio = formData.get("bio");
  const phone = formData.get("phone");

  await db
    .update(member)
    .set({
      bio: typeof bio === "string" && bio.trim() !== "" ? bio.trim() : null,
      phone: typeof phone === "string" && phone.trim() !== "" ? phone.trim() : null,
      updatedAt: new Date(),
    })
    .where(eq(member.id, session.member.id));

  revalidatePath("/settings");
  return { status: "success" };
}
