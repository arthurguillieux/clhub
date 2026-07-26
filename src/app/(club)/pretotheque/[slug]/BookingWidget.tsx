"use client";

import { useActionState, useState } from "react";
import { formatFrench, type CalendarDate } from "@/core/date";
import { MonthCalendar, type CalendarBooking } from "@/core/ui/calendar/MonthCalendar";
import { Button } from "@/core/ui/components/Button";
import { FormField, Textarea } from "@/core/ui/components/Field";
import { joinWaitlistAction, requestBooking, type RequestBookingState } from "./actions";

const initialState: RequestBookingState = { status: "idle" };

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
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const action = requestBooking.bind(null, itemId, itemSlug);
  const [state, formAction, pending] = useActionState(action, initialState);

  function updateRange(next: { start: CalendarDate; end: CalendarDate }) {
    setRange(next);
    setWaitlistJoined(false);
  }

  async function handleJoinWaitlist() {
    if (!range) return;
    const result = await joinWaitlistAction(itemId, itemSlug, range.start, range.end);
    if (result.ok) setWaitlistJoined(true);
  }

  return (
    <div>
      <MonthCalendar category={category} bookings={bookings} onSelectRange={updateRange} />

      {range && (
        <form
          action={formAction}
          className="mt-4 flex flex-col gap-3 rounded-md border border-line-soft bg-surface p-4"
        >
          <input type="hidden" name="startDate" value={range.start} />
          <input type="hidden" name="endDate" value={range.end} />
          <p className="text-sm text-ink">
            Du <strong>{formatFrench(range.start)}</strong> au{" "}
            <strong>{formatFrench(range.end)}</strong>
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
            <div className="text-sm text-red-600 dark:text-red-400">
              <p>{state.message}</p>
              {state.suggestions && state.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">Libre à la place :</span>
                  {state.suggestions.map((s) => (
                    <button
                      key={`${s.start}-${s.end}`}
                      type="button"
                      onClick={() =>
                        updateRange({ start: s.start as CalendarDate, end: s.end as CalendarDate })
                      }
                      className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface"
                    >
                      {formatFrench(s.start as CalendarDate)} → {formatFrench(s.end as CalendarDate)}
                    </button>
                  ))}
                </div>
              )}
              {state.suggestions !== undefined && (
                <p className="mt-2">
                  {waitlistJoined ? (
                    "On te prévient dès que ces dates se libèrent !"
                  ) : (
                    <button
                      type="button"
                      onClick={handleJoinWaitlist}
                      className="text-xs font-semibold text-ink underline underline-offset-2 hover:text-primary"
                    >
                      Me prévenir si ça se libère
                    </button>
                  )}
                </p>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
