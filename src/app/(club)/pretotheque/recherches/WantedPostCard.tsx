"use client";

import { useTransition } from "react";
import { formatFrench, type CalendarDate } from "@/core/date";
import { Button } from "@/core/ui/components/Button";
import { closeWantedPostAction, expressInterestAction, withdrawInterestAction } from "./actions";

export function WantedPostCard({
  id,
  title,
  description,
  neededBy,
  requesterName,
  interestCount,
  isInterested,
  isRequester,
  groupBuyTriggered,
}: {
  id: string;
  title: string;
  description: string | null;
  neededBy: string | null;
  requesterName: string;
  interestCount: number;
  isInterested: boolean;
  isRequester: boolean;
  groupBuyTriggered: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{title}</p>
          <p className="text-xs text-muted">
            {requesterName}
            {neededBy && ` — besoin avant le ${formatFrench(neededBy as CalendarDate)}`}
          </p>
        </div>
        {isRequester && (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => closeWantedPostAction(id))}
            className="text-xs text-muted underline underline-offset-2 hover:text-ink"
          >
            Marquer comme résolu
          </button>
        )}
      </div>

      {description && <p className="text-sm text-ink">{description}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted">
          {interestCount === 0
            ? "Personne d'intéressé pour l'instant"
            : `${interestCount} intéressé${interestCount > 1 ? "s" : ""}`}
        </span>
        {!isRequester &&
          (isInterested ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => startTransition(() => withdrawInterestAction(id))}
            >
              Intéressé ✓ — annuler
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => startTransition(() => expressInterestAction(id))}
            >
              Je suis intéressé
            </Button>
          ))}
      </div>

      {groupBuyTriggered && (
        <p className="rounded-md bg-accent/10 p-2 text-sm font-medium text-ink">
          {`On est ${interestCount} — on l'achète ensemble ?`}
        </p>
      )}
    </div>
  );
}
