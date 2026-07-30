"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { logActivity } from "@/core/activity";
import { createNotification } from "@/core/notifications";
import { saveDonPhoto } from "@/core/storage/donPhoto";
import {
  createListing,
  updateListing,
  deleteListing,
  getListingById,
  getListingDetail,
  setListingPhoto,
  expressInterest,
  withdrawInterest,
  chooseInterest,
  cancelReservation,
  markCompleted,
} from "@/modules/dons/data/listings";

const listingSchema = z.object({
  categoryId: z.string().uuid("Choisis une catégorie."),
  title: z.string().trim().min(1, "Donne un nom à cette annonce.").max(150),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
  priceText: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
  isFree: z.boolean(),
});

function readListingForm(formData: FormData) {
  return listingSchema.safeParse({
    categoryId: formData.get("categoryId"),
    title: formData.get("title"),
    description: formData.get("description"),
    // The price field is unmounted entirely (not just emptied) when "don
    // gratuit" is checked — formData.get returns null, not "", which
    // z.string().optional() doesn't accept (only undefined).
    priceText: formData.get("priceText") ?? undefined,
    isFree: formData.get("isFree") === "on",
  });
}

export type CreateListingState = { status: "idle" } | { status: "error"; message: string };

export async function createListingAction(
  _prevState: CreateListingState,
  formData: FormData,
): Promise<CreateListingState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = readListingForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const created = await createListing(session.member.id, { ...parsed.data, photoPath: null });

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const path = await saveDonPhoto(created.id, buffer);
    await setListingPhoto(created.id, path);
  }

  await logActivity({
    section: "dons",
    kind: "don.posted",
    actorId: session.member.id,
    subjectRef: `don:${created.id}`,
    payload: { title: created.title },
  });

  revalidatePath("/dons");
  redirect(`/dons/${created.id}`);
}

export type UpdateListingState = { status: "idle" } | { status: "error"; message: string };

/** Owner or admin — same split as recipe/item editing. */
export async function updateListingAction(
  listingId: string,
  _prevState: UpdateListingState,
  formData: FormData,
): Promise<UpdateListingState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const target = await getListingById(listingId);
  if (!target) return { status: "error", message: "Cette annonce n'existe plus." };

  const isAdmin = await isAdminModeActive();
  if (target.createdById !== session.member.id && !isAdmin) {
    return { status: "error", message: "Tu n'as pas le droit de modifier cette annonce." };
  }

  const parsed = readListingForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await updateListing(listingId, parsed.data);

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const path = await saveDonPhoto(listingId, buffer);
    await setListingPhoto(listingId, path);
  }

  revalidatePath(`/dons/${listingId}`);
  revalidatePath("/dons");
  redirect(`/dons/${listingId}`);
}

/** Admin-mode only — same split as recipe/item deletion. */
export async function deleteListingAction(listingId: string): Promise<void> {
  const isAdmin = await isAdminModeActive();
  if (!isAdmin) return;

  await deleteListing(listingId);
  revalidatePath("/dons");
  redirect("/dons");
}

export async function expressInterestAction(listingId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const target = await getListingById(listingId);
  if (!target || target.status !== "available" || target.createdById === session.member.id) return;

  await expressInterest(listingId, session.member.id);

  if (target.createdById !== session.member.id) {
    await createNotification({
      memberId: target.createdById,
      kind: "don.interest",
      entityRef: `don:${listingId}`,
      payload: { memberName: session.user.name, title: target.title },
    });
  }

  revalidatePath(`/dons/${listingId}`);
}

export async function withdrawInterestAction(listingId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  await withdrawInterest(listingId, session.member.id);
  revalidatePath(`/dons/${listingId}`);
}

/** Owner or admin — the giver picks who among the interested members gets it. */
export async function chooseInterestAction(listingId: string, memberId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const target = await getListingById(listingId);
  if (!target) return;

  const isAdmin = await isAdminModeActive();
  if (target.createdById !== session.member.id && !isAdmin) return;

  await chooseInterest(listingId, memberId);

  const detail = await getListingDetail(listingId);
  await createNotification({
    memberId,
    kind: "don.reserved",
    entityRef: `don:${listingId}`,
    payload: { title: detail?.title ?? target.title },
  });

  revalidatePath(`/dons/${listingId}`);
}

/** Owner or admin. */
export async function cancelReservationAction(listingId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const target = await getListingById(listingId);
  if (!target) return;

  const isAdmin = await isAdminModeActive();
  if (target.createdById !== session.member.id && !isAdmin) return;

  await cancelReservation(listingId);
  revalidatePath(`/dons/${listingId}`);
}

/** Owner or admin. */
export async function markCompletedAction(listingId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const target = await getListingById(listingId);
  if (!target) return;

  const isAdmin = await isAdminModeActive();
  if (target.createdById !== session.member.id && !isAdmin) return;

  await markCompleted(listingId);
  revalidatePath(`/dons/${listingId}`);
  revalidatePath("/dons");
}
