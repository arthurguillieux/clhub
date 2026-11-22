import { Card } from "@/core/ui/components/Card";
import { RelativeTime } from "@/core/ui/components/RelativeTime";
import type { InvitedAddress } from "@/modules/invitations/data";
import { InvitationActions } from "./InvitationActions";

const STATUS: Record<InvitedAddress["status"], { label: string; className: string }> = {
  joined: { label: "a rejoint le CLHUB", className: "bg-primary/15 text-primary" },
  pending: { label: "en attente", className: "bg-accent/25 text-ink" },
  expired: { label: "lien expiré", className: "bg-red-500/10 text-red-700 dark:text-red-300" },
};

/**
 * The invited addresses: whether they joined (and under which name), the link still valid or not,
 * and « Renvoyer l'invitation » or « Révoquer » for those who haven't come yet. `showInviters` for the admin's list.
 */
export function InvitationList({ invitations, showInviters = false }: { invitations: InvitedAddress[]; showInviters?: boolean }) {
  // showInviters: the admin's list, where « Révoquer » takes every invitation of the address.
  return (
    <ul className="flex flex-col gap-2">
      {invitations.map((i) => {
        const status = STATUS[i.status];
        return (
          <li key={i.email}>
            <Card className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-ink">{i.email}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {i.joined ? (
                    <>
                      Membre sous le nom de <b className="text-ink">{i.joined.name}</b>, depuis <RelativeTime date={i.joined.since} />.
                    </>
                  ) : (
                    <>
                      {i.sends > 1 ? `${i.sends} envois, le dernier ` : "Envoyée "}
                      <RelativeTime date={i.lastSentAt} />
                      {i.status === "pending" ? (
                        <>
                          {" "}
                          · le lien expire <RelativeTime date={i.expiresAt} />
                        </>
                      ) : (
                        " · le lien ne marche plus"
                      )}
                      .
                    </>
                  )}
                  {showInviters && <span className="block">Invitée par {i.inviters.join(", ")}.</span>}
                </p>
              </div>
              {i.status !== "joined" && <InvitationActions email={i.email} admin={showInviters} />}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
