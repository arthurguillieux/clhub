"use client";

import { useState } from "react";
import { authClient } from "@/core/auth/client";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";

type State = { status: "idle" | "sent" | "error"; message?: string };

export function SignInForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [state, setState] = useState<State>({ status: "idle" });
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await authClient.signIn.magicLink({
      email,
      // Only used if this email is signing up for the first time — a
      // starting point, editable later from the member's own profile.
      name: email.split("@")[0] ?? email,
      callbackURL: "/bienvenue",
    });
    setPending(false);
    setState(error ? { status: "error", message: error.message } : { status: "sent" });
  }

  if (state.status === "sent") {
    return (
      <p className="text-center text-sm text-ink">
        Vérifie ta boîte mail — le lien arrive dans quelques instants.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Ton adresse mail" htmlFor="email">
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@example.com"
        />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi..." : "Recevoir mon lien de connexion"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
