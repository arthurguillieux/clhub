"use client";

import { useState, useTransition } from "react";
import { Button } from "@/core/ui/components/Button";
import { callError } from "@/core/ui/callError";
import { resendInvitationAction } from "./actions";

/** « Renvoyer l'invitation »: a new link (valid 14 days) to the same address. */
export function ResendButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        disabled={pending || message?.ok === true}
        aria-label={`Renvoyer l'invitation à ${email}`}
        onClick={() =>
          start(async () => {
            try {
              const done = await resendInvitationAction(email);
              setMessage(done.ok ? { ok: true, text: "Invitation renvoyée ✓" } : { ok: false, text: done.error });
            } catch (e) {
              setMessage({ ok: false, text: callError(e) });
            }
          })
        }
      >
        {pending ? "Envoi…" : message?.ok ? "Renvoyée ✓" : "Renvoyer l'invitation"}
      </Button>
      {message && !message.ok && <p className="max-w-xs text-right text-xs text-red-600 dark:text-red-400">{message.text}</p>}
    </div>
  );
}
