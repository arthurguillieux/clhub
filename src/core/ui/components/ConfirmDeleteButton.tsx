"use client";

import { useState, useTransition, type ReactNode } from "react";

/**
 * The one delete-with-confirmation control — every « Supprimer » on the site
 * goes through it, so wording, look, focus and touch size stay the same
 * everywhere instead of drifting copy by copy.
 *
 * Buttons are named after what they do (« Supprimer la recette » / « Garder »),
 * never « Confirmer / Annuler »: the safe option takes focus, and each caller
 * supplies the words for its own object.
 *
 * `quiet` is for small contributions (a comment, a review): a muted link instead
 * of a red one. `detail` switches the confirmation to a framed panel, for
 * deletions with consequences worth listing first (see DeleteMemberButton).
 */
export function ConfirmDeleteButton({
  question,
  confirmLabel,
  keepLabel = "Garder",
  pendingLabel = "Suppression…",
  triggerLabel = "Supprimer",
  quiet = false,
  detail,
  onConfirm,
}: {
  /** Asked once the trigger is pressed — « Supprimer la recette X et ses avis ? » */
  question: string;
  /** What the red button says — « Supprimer la recette ». */
  confirmLabel: string;
  keepLabel?: string;
  pendingLabel?: string;
  triggerLabel?: string;
  quiet?: boolean;
  detail?: ReactNode;
  onConfirm: () => void | Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    // -my / py cancel out in layout but widen the hit area to a comfortable thumb size.
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`-mx-1.5 -my-2.5 px-1.5 py-2.5 text-xs ${
          quiet
            ? "text-muted underline underline-offset-2 hover:text-red-600 dark:hover:text-red-400"
            : "font-semibold text-red-600 hover:underline dark:text-red-400"
        }`}
      >
        {triggerLabel}
      </button>
    );
  }

  const confirmButton = (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await onConfirm();
          setConfirming(false);
        })
      }
      className="min-h-9 rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-red-500"
    >
      {pending ? pendingLabel : confirmLabel}
    </button>
  );
  const keepButton = (
    <button
      type="button"
      disabled={pending}
      autoFocus
      onClick={() => setConfirming(false)}
      className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-ink hover:bg-surface-raised disabled:opacity-50"
    >
      {keepLabel}
    </button>
  );

  if (detail) {
    return (
      <div role="group" aria-label={question} className="mt-2 w-full rounded-md border border-red-600/40 bg-surface p-3 text-sm dark:border-red-400/40">
        <p className="font-semibold text-ink">{question}</p>
        <div className="mt-1.5 text-muted">{detail}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {confirmButton}
          {keepButton}
        </div>
      </div>
    );
  }

  return (
    <div role="group" aria-label={question} className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted">{question}</span>
      {confirmButton}
      {keepButton}
    </div>
  );
}
