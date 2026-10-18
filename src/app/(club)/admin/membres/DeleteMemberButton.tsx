"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { adminDeleteMemberAction } from "../actions";
import type { MemberDeletionImpact } from "@/modules/admin/data/members";

const IMPACT_LABELS: Record<keyof MemberDeletionImpact, string> = {
  itemsOwned: "objet(s) de la prêtothèque",
  bookingsAsBorrower: "emprunt(s)",
  wantedPosts: "recherche(s) publiée(s)",
  projects: "chantier(s)",
  menuEvents: "repas proposé(s)",
  expenseEventsOrganized: "évènement(s) de caisse organisé(s)",
  expensesInvolved: "dépense(s) de caisse (payée(s) ou saisie(s))",
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
  const nonZero = (Object.keys(impact) as (keyof MemberDeletionImpact)[]).filter((k) => impact[k] > 0);

  return (
    <ConfirmDeleteButton
      question={`Supprimer le compte de ${name} ?`}
      confirmLabel="Supprimer le compte"
      keepLabel="Garder le compte"
      detail={
        <>
          {nonZero.length > 0 ? (
            <ul className="list-inside list-disc">
              {nonZero.map((k) => (
                <li key={k}>
                  {impact[k]} {IMPACT_LABELS[k]}
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucune donnée liée — suppression sans impact ailleurs.</p>
          )}
          <p className="mt-1.5">Tout sera supprimé définitivement, sans autre confirmation.</p>
        </>
      }
      onConfirm={() => adminDeleteMemberAction(memberId)}
    />
  );
}
