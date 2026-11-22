"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { reportBugAction, type ReportState } from "./actions";

export function ReportForm({ page }: { page: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportBugAction, { status: "idle" });
  if (state.status === "sent")
    return (
      <div className="mt-6 rounded-md border border-line bg-surface-raised p-5">
        <p className="font-display text-lg font-bold text-ink">Merci, c&apos;est envoyé ✓</p>
        <p className="mt-1 text-sm text-muted">Arthur a reçu ton signalement. S&apos;il a besoin d&apos;en savoir plus, il te le dira.</p>
        {page && (
          <Link href={page} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            ← Revenir à la page
          </Link>
        )}
      </div>
    );
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <FormField label="Ce qui s'est passé" htmlFor="bug-message">
        <Textarea
          id="bug-message"
          name="message"
          required
          minLength={5}
          maxLength={4000}
          rows={6}
          placeholder="Ce que tu faisais, ce que tu attendais, ce qui s'est passé à la place (un message d'erreur ? une page blanche ?)"
        />
      </FormField>
      <FormField label="La page concernée" htmlFor="bug-page">
        <Input id="bug-page" name="page" defaultValue={page} placeholder="/…" maxLength={300} />
      </FormField>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Envoi…" : "Envoyer le signalement"}
      </Button>
    </form>
  );
}
