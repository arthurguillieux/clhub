"use client";

import { useTransition } from "react";
import { Button } from "@/core/ui/components/Button";
import { chooseInterestAction, cancelReservationAction, markCompletedAction } from "../actions";

interface Interest {
  memberId: string;
  memberName: string;
  createdAt: Date;
}

/** Rendered for the giver (or an admin) only — see [id]/page.tsx. */
export function OwnerControls({
  listingId,
  status,
  interests,
  reservedForName,
}: {
  listingId: string;
  status: string;
  interests: Interest[];
  reservedForName: string | null;
}) {
  const [pending, startTransition] = useTransition();

  if (status === "reserved") {
    return (
      <div className="rounded-md border border-primary/40 bg-primary/10 p-4">
        <p className="text-sm font-semibold text-ink">Réservé pour {reservedForName ?? "?"}.</p>
        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            variant="accent"
            disabled={pending}
            onClick={() => startTransition(() => markCompletedAction(listingId))}
          >
            {pending ? "..." : "Marquer comme donné / vendu"}
          </Button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => cancelReservationAction(listingId))}
            className="text-xs text-muted underline underline-offset-2 hover:text-ink"
          >
            Annuler la réservation
          </button>
        </div>
      </div>
    );
  }

  if (status === "available") {
    if (interests.length === 0) {
      return <p className="text-sm text-muted">Personne d&apos;intéressé pour l&apos;instant.</p>;
    }
    return (
      <div>
        <p className="text-sm text-muted">Par ordre d&apos;arrivée :</p>
        <ul className="mt-2 flex flex-col gap-2">
          {interests.map((i, index) => (
            <li
              key={i.memberId}
              className="flex items-center justify-between gap-3 rounded-md border border-line p-3"
            >
              <span className="text-sm text-ink">
                <span className="mr-2 font-mono text-xs text-muted">#{index + 1}</span>
                {i.memberName}
                <span className="ml-2 text-xs text-muted">
                  {i.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => chooseInterestAction(listingId, i.memberId))}
                className="rounded-md border border-primary/50 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                Choisir
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}
