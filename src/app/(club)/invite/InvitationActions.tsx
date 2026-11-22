"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/core/ui/components/Button";
import { callError } from "@/core/ui/callError";
import { resendInvitationAction, revokeInvitationAction } from "./actions";

/**
 * What can be done with an invitation not accepted yet: « Renvoyer l'invitation » (a new 14-day link),
 * or « Révoquer » (the address leaves the list; asked once, with what it does).
 */
export function InvitationActions({ email, admin = false }: { email: string; admin?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const run = (call: () => Promise<{ ok: true; info?: string } | { ok: false; error: string }>, done: string, after?: () => void) =>
    start(async () => {
      try {
        const r = await call();
        setMessage(r.ok ? { ok: true, text: r.info ?? done } : { ok: false, text: r.error });
        if (r.ok) after?.();
      } catch (e) {
        setMessage({ ok: false, text: callError(e) });
      }
    });

  if (revoked)
    return (
      <p role="status" className="max-w-xs text-right text-sm text-muted">
        {message?.text}
      </p>
    );
  return (
    <div className="flex flex-col items-end gap-1">
      {revoking ? (
        <div className="flex max-w-xs flex-col items-end gap-2 text-right text-sm">
          <p>{admin ? `Révoquer toutes les invitations de ${email} ? Les liens ne marcheront plus et l'adresse ne pourra plus créer de compte.` : `Révoquer ton invitation à ${email} ? Le lien ne marchera plus.`}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              className="bg-red-600 text-white hover:opacity-90"
              disabled={pending}
              onClick={() =>
                run(
                  () => revokeInvitationAction(email),
                  "Invitation révoquée.",
                  () => {
                    setRevoked(true);
                    setTimeout(() => router.refresh(), 4000);
                  },
                )
              }
            >
              {pending ? "Révocation…" : "Révoquer l'invitation"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRevoking(false)}>
              Garder
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending || message?.ok === true} aria-label={`Renvoyer l'invitation à ${email}`} onClick={() => run(() => resendInvitationAction(email), "Invitation renvoyée ✓")}>
            {pending ? "Envoi…" : message?.ok ? "Renvoyée ✓" : "Renvoyer l'invitation"}
          </Button>
          <Button type="button" variant="ghost" className="text-red-700 dark:text-red-300" aria-label={`Révoquer l'invitation à ${email}`} onClick={() => setRevoking(true)}>
            Révoquer
          </Button>
        </div>
      )}
      {message && !message.ok && <p className="max-w-xs text-right text-xs text-red-600 dark:text-red-400">{message.text}</p>}
    </div>
  );
}
