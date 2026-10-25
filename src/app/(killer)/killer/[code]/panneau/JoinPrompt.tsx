"use client";

import Link from "next/link";
import { useActionState } from "react";
import { joinOrganizationAction, type FormState } from "../../actions";

const idle: FormState = { status: "idle" };

/** Shown to a member who opens a game they don't organize: its co-organization password lets them in. */
export function JoinPrompt({ code, title, hasPassword }: { code: string; title: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState(joinOrganizationAction, idle);
  return (
    <main className="killer flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="killer-panel w-full max-w-sm p-5">
        <p className="killer-label">Code {code}</p>
        <h1 className="killer-title mt-1 text-xl">{title}</h1>
        {hasPassword ? (
          <form action={action} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="code" value={code} />
            <label className="text-sm text-[var(--k-muted)]" htmlFor="cohost-password">
              Tape le mot de passe de co-organisation que l&apos;organisateur t&apos;a donné.
            </label>
            <input id="cohost-password" name="password" autoComplete="off" autoFocus className="killer-field min-h-12 px-3" />
            {state.status === "error" && (
              <p role="alert" className="text-sm text-[var(--k-alert)]">
                {state.message}
              </p>
            )}
            <button type="submit" className="killer-btn min-h-12 px-4" disabled={pending}>
              {pending ? "Vérification…" : "Co-organiser la partie"}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-[var(--k-muted)]">
            Tu n&apos;organises pas cette partie. Demande à son organisateur de t&apos;ajouter comme co-organisateur, ou de lui
            donner un mot de passe de co-organisation.
          </p>
        )}
        <Link href="/jeux/killer" className="killer-btn-ghost mt-4 flex min-h-11 items-center justify-center px-4 text-sm">
          Retour
        </Link>
      </div>
    </main>
  );
}
