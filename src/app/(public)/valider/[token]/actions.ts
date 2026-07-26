"use server";

import { consumeActionToken, invalidateSiblingTokens, lookupActionToken } from "@/core/action-tokens";
import { logActivity } from "@/core/activity";
import { createNotification } from "@/core/notifications";
import { getBookingWithItem, respondToBooking } from "@/modules/pretotheque/data/bookings";
import { describeRespondError, describeTokenError } from "./labels";

export type ConfirmState =
  | { status: "idle" }
  | { status: "success"; decision: "approved" | "rejected" }
  | { status: "error"; message: string };

export async function confirmAction(
  token: string,
  // required by useActionState's signature but unused here — this action takes no form fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ConfirmState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<ConfirmState> {
  const lookup = await lookupActionToken(token);
  if (!lookup.ok) {
    return { status: "error", message: describeTokenError(lookup.reason) };
  }

  const { row } = lookup;
  const bookingId = (row.payload as { bookingId?: string }).bookingId;
  if (!bookingId || (row.action !== "booking.approve" && row.action !== "booking.reject")) {
    return { status: "error", message: "Lien invalide." };
  }

  const decision = row.action === "booking.approve" ? "approved" : "rejected";
  const result = await respondToBooking(bookingId, decision, row.memberId);
  if (!result.ok) {
    return { status: "error", message: describeRespondError(result.reason) };
  }

  await consumeActionToken(row.id);
  await invalidateSiblingTokens(row.memberId, "bookingId", bookingId, row.id);

  const bookingWithItem = await getBookingWithItem(bookingId);
  if (bookingWithItem) {
    await logActivity({
      section: "pretotheque",
      kind: decision === "approved" ? "booking.approved" : "booking.rejected",
      actorId: row.memberId,
      subjectRef: `booking:${bookingId}`,
      payload: {
        itemName: bookingWithItem.item.name,
        startDate: bookingWithItem.startDate,
        endDate: bookingWithItem.endDate,
      },
    });

    await createNotification({
      memberId: bookingWithItem.borrowerId,
      kind: decision === "approved" ? "booking.approved" : "booking.rejected",
      entityRef: `booking:${bookingId}`,
      payload: {
        itemName: bookingWithItem.item.name,
        startDate: bookingWithItem.startDate,
        endDate: bookingWithItem.endDate,
      },
    });
  }

  return { status: "success", decision };
}
