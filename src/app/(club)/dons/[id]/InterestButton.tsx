"use client";

import { useTransition } from "react";
import { Button } from "@/core/ui/components/Button";
import { expressInterestAction, withdrawInterestAction } from "../actions";

export function InterestButton({ listingId, isInterested }: { listingId: string; isInterested: boolean }) {
  const [pending, startTransition] = useTransition();

  if (isInterested) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-primary">Tu es sur la liste des intéressé·es.</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => withdrawInterestAction(listingId))}
          className="text-xs text-muted underline underline-offset-2 hover:text-ink"
        >
          Me retirer
        </button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="accent"
      disabled={pending}
      onClick={() => startTransition(() => expressInterestAction(listingId))}
    >
      {pending ? "..." : "Je suis intéressé·e"}
    </Button>
  );
}
