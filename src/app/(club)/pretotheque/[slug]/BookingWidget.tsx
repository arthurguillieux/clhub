"use client";

import { useActionState, useState } from "react";
import type { CalendarDate } from "@/core/date";
import { MonthCalendar, type CalendarBooking } from "@/core/ui/calendar/MonthCalendar";
import { Button } from "@/core/ui/components/Button";
import { FormField, Textarea } from "@/core/ui/components/Field";
import { requestBooking, type RequestBookingState } from "./actions";

const initialState: RequestBookingState = { status: "idle" };

function formatFr(date: CalendarDate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function BookingWidget({
  itemId,
  itemSlug,
  category,
  bookings,
}: {
  itemId: string;
  itemSlug: string;
  category: string;
  bookings: CalendarBooking[];
}) {
  const [range, setRange] = useState<{ start: CalendarDate; end: CalendarDate } | null>(null);
  const action = requestBooking.bind(null, itemId, itemSlug);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div>
      <MonthCalendar category={category} bookings={bookings} onSelectRange={setRange} />

      {range && (
        <form
          action={formAction}
          className="mt-4 flex flex-col gap-3 rounded-md border border-line-soft bg-surface p-4"
        >
          <input type="hidden" name="startDate" value={range.start} />
          <input type="hidden" name="endDate" value={range.end} />
          <p className="text-sm text-ink">
            Du <strong>{formatFr(range.start)}</strong> au <strong>{formatFr(range.end)}</strong>
          </p>
          <FormField label="Message pour le propriétaire (optionnel)" htmlFor="message">
            <Textarea id="message" name="message" rows={2} placeholder="Pour refaire ma terrasse..." />
          </FormField>
          <Button type="submit" disabled={pending} variant="accent" className="self-start">
            {pending ? "Envoi..." : "Demander à emprunter"}
          </Button>
          {state.status === "success" && (
            <p className="text-sm text-green-700 dark:text-green-400">
              {state.approved
                ? "Réservé automatiquement !"
                : "Demande envoyée — le propriétaire doit valider."}
            </p>
          )}
          {state.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          )}
        </form>
      )}
    </div>
  );
}
