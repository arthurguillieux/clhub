"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import {
  createBookingRequest,
  updateBookingDates,
  type BookingRequestResult,
} from "@/modules/pretotheque/data/bookings";
import { joinWaitlist } from "@/modules/pretotheque/data/waitlist";
import { addComment } from "@/modules/pretotheque/data/comments";
import { reportIssue, resolveMaintenance } from "@/modules/pretotheque/data/maintenance";
import {
  addItemPhotos,
  deleteItemPhoto,
  moveItemPhoto,
  setPrimaryItemPhoto,
} from "@/modules/pretotheque/data/itemPhotos";

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
  const result = await addItemPhotos(itemId, session.member.id, buffers);
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
  await setPrimaryItemPhoto(itemId, session.member.id, photoId);
  revalidatePath(`/pretotheque/${itemSlug}`);
}

export async function deleteItemPhotoAction(
  itemId: string,
  itemSlug: string,
  photoId: string,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await deleteItemPhoto(itemId, session.member.id, photoId);
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
  await moveItemPhoto(itemId, session.member.id, photoId, direction);
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

  const result = await resolveMaintenance(itemId, session.member.id, parsed.data.note);
  if (!result.ok) {
    return {
      status: "error",
      message: result.reason === "forbidden" ? "Seul le propriétaire peut faire ça." : "Cet objet n'existe plus.",
    };
  }

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { status: "success" };
}
