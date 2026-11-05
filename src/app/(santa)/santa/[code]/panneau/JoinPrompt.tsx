"use client";

import Link from "next/link";
import { useActionState } from "react";
import { joinSantaAction, type FormState } from "../../actions";

const idle: FormState = { status: "idle" };

/** Shown to a member who opens a Secret Santa they don't organize: its co-organization password lets them in. */
export function JoinPrompt({ code, title, hasPassword }: { code: string; title: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState(joinSantaAction, idle);
  return (
    <div className="santa-panel mx-auto mt-16 max-w-sm p-5">
      <p className="santa-label">Code {code}</p>
      <h1 className="santa-title mt-1 text-2xl">{title}</h1>
      {hasPassword ? (
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="code" value={code} />
          <label className="text-sm text-[var(--s-muted)]" htmlFor="cohost-password">
            Tape le mot de passe de co-organisation que son organisateur t&apos;a donné.
          </label>
          <input id="cohost-password" name="password" autoComplete="off" autoFocus className="santa-field min-h-12 px-3" />
          {state.status === "error" && (
            <p role="alert" className="text-sm text-[var(--s-red)]">
              {state.message}
            </p>
          )}
          <button type="submit" className="santa-btn min-h-12 px-4" disabled={pending}>
            {pending ? "Vérification…" : "Co-organiser ce Secret Santa"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-[var(--s-muted)]">Seuls ses organisateurs ont accès à cette page. Demande à être ajouté·e, ou à recevoir un mot de passe de co-organisation.</p>
      )}
      <Link href="/jeux/santa" className="santa-btn-ghost mt-4 flex min-h-11 items-center justify-center px-4 text-sm">
        Retour
      </Link>
    </div>
  );
}
