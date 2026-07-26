import { notFound } from "next/navigation";
import { formatFrench, type CalendarDate } from "@/core/date";
import { lookupActionToken } from "@/core/action-tokens";
import { getBookingWithItem } from "@/modules/pretotheque/data/bookings";
import { Card } from "@/core/ui/components/Card";
import { ConfirmForm } from "./ConfirmForm";
import { describeTokenError } from "./labels";

export default async function ValidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await lookupActionToken(token);

  if (!lookup.ok) {
    return (
      <Card className="p-6">
        <h1 className="font-display text-xl font-extrabold text-ink">Lien invalide</h1>
        <p className="mt-2 text-sm text-muted">{describeTokenError(lookup.reason)}</p>
      </Card>
    );
  }

  const bookingId = (lookup.row.payload as { bookingId?: string }).bookingId;
  const bookingWithItem = bookingId ? await getBookingWithItem(bookingId) : null;
  if (!bookingWithItem) {
    notFound();
  }

  const isApprove = lookup.row.action === "booking.approve";

  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-extrabold text-ink">
        {isApprove ? "Accepter la demande ?" : "Refuser la demande ?"}
      </h1>
      <p className="mt-3 text-sm text-ink">
        {bookingWithItem.borrowerName} veut emprunter <strong>{bookingWithItem.item.name}</strong>.
      </p>
      <p className="mt-1 text-sm text-muted">
        Du {formatFrench(bookingWithItem.startDate as CalendarDate)} au{" "}
        {formatFrench(bookingWithItem.endDate as CalendarDate)}
      </p>
      {bookingWithItem.message && (
        <p className="mt-3 border-l-2 border-line-soft pl-3 text-sm text-ink italic">
          « {bookingWithItem.message} »
        </p>
      )}
      <ConfirmForm token={token} isApprove={isApprove} />
    </Card>
  );
}
