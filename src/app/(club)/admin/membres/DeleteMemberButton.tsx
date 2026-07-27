"use client";

import { useState, useTransition } from "react";
import { adminDeleteMemberAction } from "../actions";
import type { MemberDeletionImpact } from "@/modules/admin/data/members";

const IMPACT_LABELS: Record<keyof MemberDeletionImpact, string> = {
  itemsOwned: "objet(s) de la prêtothèque",
  bookingsAsBorrower: "emprunt(s)",
  wantedPosts: "recherche(s) publiée(s)",
  projects: "chantier(s)",
  menuEvents: "repas proposé(s)",
  caisseTransactions: "mouvement(s) de caisse",
  recipes: "recette(s)",
  activityEntries: "entrée(s) dans le flux d'activité",
  notifications: "notification(s)",
  invitationsSent: "invitation(s) envoyée(s)",
};

export function DeleteMemberButton({
  memberId,
  name,
  impact,
}: {
  memberId: string;
  name: string;
  impact: MemberDeletionImpact;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const nonZero = (Object.keys(impact) as (keyof MemberDeletionImpact)[]).filter(
    (k) => impact[k] > 0,
  );

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold text-red-600 hover:underline dark:text-red-400"
      >
        Supprimer
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-md border border-red-600/40 bg-surface p-3 text-sm dark:border-red-400/40">
      <p className="font-semibold text-ink">Supprimer {name} ?</p>
      {nonZero.length > 0 ? (
        <ul className="mt-1.5 list-inside list-disc text-muted">
          {nonZero.map((k) => (
            <li key={k}>
              {impact[k]} {IMPACT_LABELS[k]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-muted">Aucune donnée liée — suppression sans impact ailleurs.</p>
      )}
      <p className="mt-1.5 text-muted">Tout sera supprimé définitivement, sans confirmation supplémentaire.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => adminDeleteMemberAction(memberId))}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-red-500"
        >
          {pending ? "Suppression..." : "Confirmer la suppression"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
