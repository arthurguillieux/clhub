"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import {
  createBookingRequest,
  updateBookingDates,
  type BookingRequestResult,
} from "@/modules/pretotheque/data/bookings";
import { joinWaitlist } from "@/modules/pretotheque/data/waitlist";
import { addComment, deleteComment } from "@/modules/pretotheque/data/comments";
import { reportIssue, resolveMaintenance } from "@/modules/pretotheque/data/maintenance";
import {
  addItemPhotos,
  deleteItemPhoto,
  moveItemPhoto,
  setPrimaryItemPhoto,
} from "@/modules/pretotheque/data/itemPhotos";
import {
  addItemUnit,
  archiveItemUnit,
  renameItemUnit,
  unarchiveItemUnit,
  type UnitResult,
} from "@/modules/pretotheque/data/itemUnits";
import { getItemBySlug, updateItem } from "@/modules/pretotheque/data/items";
import { itemFormSchema, itemFormDataToInput } from "@/modules/pretotheque/itemFormSchema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

const schema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  message: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type RequestBookingState =
  | { status: "idle" }
  | { status: "success"; approved: boolean }
  | { status: "error"; message: string; suggestions?: { start: string; end: string }[] };

function describeRejection(result: Extract<BookingRequestResult, { ok: false }>): string {
  switch (result.reason) {
    case "invalid-range":
      return "La date de fin doit être après la date de début.";
    case "overlap":
      return "Ces dates sont déjà prises — choisis une autre période.";
    case "too-long":
      return `Ce prêt dépasse la durée maximale autorisée par le propriétaire (${result.maxDays} jours).`;
    case "item-not-found":
      return "Cet objet n'existe plus.";
    case "item-unavailable":
      return "Cet objet n'est actuellement pas disponible au prêt.";
    case "db-conflict":
      return "Quelqu'un vient de réserver ces dates à l'instant — réessaie avec d'autres dates.";
  }
}

export async function requestBooking(
  itemId: string,
  itemSlug: string,
  _prevState: RequestBookingState,
  formData: FormData,
): Promise<RequestBookingState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", message: "Tu dois être connecté." };
  }

  const parsed = schema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Formulaire invalide." };
  }

  const result = await createBookingRequest({
    itemId,
    borrowerId: session.member.id,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    message: parsed.data.message,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: describeRejection(result),
      suggestions: result.reason === "overlap" ? result.suggestions : undefined,
    };
  }

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { status: "success", approved: result.status === "approved" };
}

export type UpdateBookingDatesActionResult =
  | { ok: true; revertedToPending: boolean }
  | { ok: false; message: string };

export async function updateBookingDatesAction(
  itemSlug: string,
  bookingId: string,
  startDate: string,
  endDate: string,
): Promise<UpdateBookingDatesActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Tu dois être connecté." };

  if (!isoDate.safeParse(startDate).success || !isoDate.safeParse(endDate).success) {
    return { ok: false, message: "Dates invalides." };
  }

  const result = await updateBookingDates(bookingId, session.member.id, startDate, endDate);
  if (!result.ok) {
    const message =
      result.reason === "forbidden"
        ? "Ce n'est pas ta réservation."
        : result.reason === "wrong-status"
          ? "Cette réservation ne peut plus être modifiée."
          : result.reason === "not-found"
            ? "Cette réservation n'existe plus."
            : describeRejection(result);
    return { ok: false, message };
  }

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { ok: true, revertedToPending: result.revertedToPending };
}

export async function joinWaitlistAction(
  itemId: string,
  itemSlug: string,
  startDate: string,
  endDate: string,
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };

  await joinWaitlist(itemId, session.member.id, startDate, endDate);
  revalidatePath(`/pretotheque/${itemSlug}`);
  return { ok: true };
}

const commentSchema = z.object({
  body: z.string().trim().min(1, "Le commentaire ne peut pas être vide.").max(1000),
});

export type PostCommentState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function postComment(
  itemId: string,
  itemSlug: string,
  _prevState: PostCommentState,
  formData: FormData,
): Promise<PostCommentState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", message: "Tu dois être connecté." };
  }

  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await addComment(itemId, session.member.id, parsed.data.body);
  revalidatePath(`/pretotheque/${itemSlug}`);
  return { status: "success" };
}

/** Admin-mode only — moderation, not a self-delete for the comment's own author. */
export async function deleteCommentAction(
  itemId: string,
  itemSlug: string,
  commentId: string,
): Promise<void> {
  const isAdmin = await isAdminModeActive();
  if (!isAdmin) return;

  await deleteComment(commentId, itemId);
  revalidatePath(`/pretotheque/${itemSlug}`);
}

export type PhotoGalleryState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

function describeGalleryError(reason: "not-found" | "forbidden"): string {
  return reason === "forbidden"
    ? "Seul le propriétaire peut gérer les photos."
    : "Cet objet n'existe plus.";
}

export async function uploadItemPhotosAction(
  itemId: string,
  itemSlug: string,
  _prevState: PhotoGalleryState,
  formData: FormData,
): Promise<PhotoGalleryState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { status: "error", message: "Choisis au moins une photo." };
  }

  const buffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
  const isAdmin = await isAdminModeActive();
  const result = await addItemPhotos(itemId, session.member.id, buffers, isAdmin);
  if (!result.ok) {
    return { status: "error", message: describeGalleryError(result.reason) };
  }

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { status: "success" };
}

export async function setPrimaryPhotoAction(
  itemId: string,
  itemSlug: string,
  photoId: string,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const isAdmin = await isAdminModeActive();
  await setPrimaryItemPhoto(itemId, session.member.id, photoId, isAdmin);
  revalidatePath(`/pretotheque/${itemSlug}`);
}

export async function deleteItemPhotoAction(
  itemId: string,
  itemSlug: string,
  photoId: string,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const isAdmin = await isAdminModeActive();
  await deleteItemPhoto(itemId, session.member.id, photoId, isAdmin);
  revalidatePath(`/pretotheque/${itemSlug}`);
}

export async function moveItemPhotoAction(
  itemId: string,
  itemSlug: string,
  photoId: string,
  direction: "up" | "down",
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const isAdmin = await isAdminModeActive();
  await moveItemPhoto(itemId, session.member.id, photoId, direction, isAdmin);
  revalidatePath(`/pretotheque/${itemSlug}`);
}

const noteSchema = z.object({
  note: z.string().trim().min(1, "Décris le problème en quelques mots.").max(500),
});

export type ReportIssueState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function reportIssueAction(
  itemId: string,
  itemSlug: string,
  _prevState: ReportIssueState,
  formData: FormData,
): Promise<ReportIssueState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = noteSchema.safeParse({ note: formData.get("note") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await reportIssue(itemId, session.member.id, parsed.data.note);
  revalidatePath(`/pretotheque/${itemSlug}`);
  return { status: "success" };
}

export async function resolveMaintenanceAction(
  itemId: string,
  itemSlug: string,
  _prevState: ReportIssueState,
  formData: FormData,
): Promise<ReportIssueState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = noteSchema.safeParse({ note: formData.get("note") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const isAdmin = await isAdminModeActive();
  const result = await resolveMaintenance(itemId, session.member.id, parsed.data.note, isAdmin);
  if (!result.ok) {
    return {
      status: "error",
      message: result.reason === "forbidden" ? "Seul le propriétaire peut faire ça." : "Cet objet n'existe plus.",
    };
  }

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { status: "success" };
}

export type UnitActionResult = { ok: true } | { ok: false; message: string };

function describeUnitError(reason: Extract<UnitResult, { ok: false }>["reason"]): string {
  switch (reason) {
    case "forbidden":
      return "Seul le propriétaire peut gérer les exemplaires.";
    case "not-found":
      return "Cet objet n'existe plus.";
    case "last-active-unit":
      return "Impossible de retirer le dernier exemplaire actif — rends plutôt l'objet indisponible si besoin.";
  }
}

export async function addItemUnitAction(
  itemId: string,
  itemSlug: string,
  label: string | null,
): Promise<UnitActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Tu dois être connecté." };

  const isAdmin = await isAdminModeActive();
  const result = await addItemUnit(itemId, session.member.id, label, isAdmin);
  if (!result.ok) return { ok: false, message: describeUnitError(result.reason) };

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { ok: true };
}

export async function renameItemUnitAction(
  itemId: string,
  itemSlug: string,
  unitId: string,
  label: string | null,
): Promise<UnitActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Tu dois être connecté." };

  const isAdmin = await isAdminModeActive();
  const result = await renameItemUnit(itemId, session.member.id, unitId, label, isAdmin);
  if (!result.ok) return { ok: false, message: describeUnitError(result.reason) };

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { ok: true };
}

export async function archiveItemUnitAction(
  itemId: string,
  itemSlug: string,
  unitId: string,
): Promise<UnitActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Tu dois être connecté." };

  const isAdmin = await isAdminModeActive();
  const result = await archiveItemUnit(itemId, session.member.id, unitId, isAdmin);
  if (!result.ok) return { ok: false, message: describeUnitError(result.reason) };

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { ok: true };
}

export async function unarchiveItemUnitAction(
  itemId: string,
  itemSlug: string,
  unitId: string,
): Promise<UnitActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Tu dois être connecté." };

  const isAdmin = await isAdminModeActive();
  const result = await unarchiveItemUnit(itemId, session.member.id, unitId, isAdmin);
  if (!result.ok) return { ok: false, message: describeUnitError(result.reason) };

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { ok: true };
}

export type UpdateItemFormState = { status: "idle" } | { status: "error"; message: string };

/** Owner or admin — unlike delete, editing your own listing is a reasonable thing for any owner to do. */
export async function updateItemAction(
  itemId: string,
  itemSlug: string,
  _prevState: UpdateItemFormState,
  formData: FormData,
): Promise<UpdateItemFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", message: "Tu dois être connecté." };
  }

  const targetItem = await getItemBySlug(itemSlug);
  if (!targetItem) {
    return { status: "error", message: "Cet objet n'existe plus." };
  }

  const isAdmin = await isAdminModeActive();
  if (targetItem.ownerId !== session.member.id && !isAdmin) {
    return { status: "error", message: "Tu n'as pas le droit de modifier cet objet." };
  }

  const parsed = itemFormSchema.safeParse(itemFormDataToInput(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  await updateItem(itemId, parsed.data);
  revalidatePath(`/pretotheque/${itemSlug}`);
  redirect(`/pretotheque/${itemSlug}`);
}
