"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { Input } from "@/core/ui/components/Field";
import { adminInviteAction, type InviteState } from "../actions";

const initialState: InviteState = { status: "idle" };

export function InviteByEmailForm() {
  const [state, formAction, pending] = useActionState(adminInviteAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      <Input
        type="email"
        name="email"
        required
        placeholder="ami@example.com"
        className="max-w-xs"
      />
      <Button type="submit" disabled={pending} variant="accent">
        {pending ? "Envoi..." : "Inviter"}
      </Button>
      {state.status === "success" && <p className="w-full text-sm text-primary">Invitation envoyée.</p>}
      {state.status === "error" && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
