import { compare, formatFrench, type CalendarDate } from "@/core/date";
import type { CalendarBooking } from "./MonthCalendar";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Confirmé",
  active: "En cours",
};

/** The mobile-friendly alternative to the month grid — same bookings, sorted as a plain list. */
export function AgendaView({ bookings }: { bookings: CalendarBooking[] }) {
  const sorted = [...bookings].sort((a, b) =>
    compare(a.startDate as CalendarDate, b.startDate as CalendarDate),
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">Rien de prévu pour l&apos;instant.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {sorted.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                b.status === "pending" ? "border border-dashed border-ink/50" : "bg-primary"
              }`}
            />
            <span className="text-ink">
              Du <strong>{formatFrench(b.startDate as CalendarDate)}</strong> au{" "}
              <strong>{formatFrench(b.endDate as CalendarDate)}</strong>
            </span>
          </div>
          <span className="whitespace-nowrap text-xs text-muted">
            {b.borrowerName} — {STATUS_LABELS[b.status] ?? b.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
