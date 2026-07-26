"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { createBookingRequest, type BookingRequestResult } from "@/modules/pretotheque/data/bookings";

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
  | { status: "error"; message: string };

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
    return { status: "error", message: describeRejection(result) };
  }

  revalidatePath(`/pretotheque/${itemSlug}`);
  return { status: "success", approved: result.status === "approved" };
}
