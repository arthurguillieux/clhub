"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/core/auth/config";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/db/client";
import { member } from "@/core/db/schema";
import { saveAvatar } from "@/core/storage/avatar";
import { fetchBusyDays } from "@/core/ical/fetch";
import { addDays, today } from "@/core/date";

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

  const name = formData.get("name");
  const bio = formData.get("bio");
  const phone = formData.get("phone");

  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (trimmedName === "") {
    return { status: "error", message: "Le nom ne peut pas être vide." };
  }

  await auth.api.updateUser({ body: { name: trimmedName }, headers: await headers() });

  await db
    .update(member)
    .set({
      bio: typeof bio === "string" && bio.trim() !== "" ? bio.trim() : null,
      phone: typeof phone === "string" && phone.trim() !== "" ? phone.trim() : null,
      updatedAt: new Date(),
    })
    .where(eq(member.id, session.member.id));

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/membres");
  return { status: "success" };
}

export type PersonalCalendarState =
  | { status: "idle" }
  | { status: "success"; eventsFound: boolean }
  | { status: "removed" }
  | { status: "error"; message: string };

/**
 * Saves the member's private ICS feed URL, testing it immediately (a quick
 * fetch over the next couple of weeks) so a typo or a copy-paste mistake is
 * caught here rather than silently showing up as "always free" later.
 */
export async function updatePersonalCalendarUrl(
  _prevState: PersonalCalendarState,
  formData: FormData,
): Promise<PersonalCalendarState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const raw = formData.get("personalCalendarUrl");
  const url = typeof raw === "string" ? raw.trim() : "";

  if (url === "") {
    await db
      .update(member)
      .set({ personalCalendarUrl: null, updatedAt: new Date() })
      .where(eq(member.id, session.member.id));
    revalidatePath("/settings");
    return { status: "removed" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "error", message: "Ce n'est pas une URL valide." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { status: "error", message: "Ce n'est pas une URL valide." };
  }

  const testStart = today();
  const busyDays = await fetchBusyDays(url, testStart, addDays(testStart, 14));
  if (busyDays === null) {
    return {
      status: "error",
      message: "Impossible de lire cet agenda — vérifie que c'est bien l'adresse secrète au format iCal.",
    };
  }

  await db
    .update(member)
    .set({ personalCalendarUrl: url, updatedAt: new Date() })
    .where(eq(member.id, session.member.id));

  revalidatePath("/settings");
  return { status: "success", eventsFound: busyDays.size > 0 };
}
