"use client";

import { useState } from "react";
import { authClient } from "@/core/auth/client";

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
      callbackURL: "/invite",
    });
    setPending(false);
    setState(
      error ? { status: "error", message: error.message } : { status: "sent" },
    );
  }

  if (state.status === "sent") {
    return <p>Vérifie ta boîte mail — le lien arrive dans quelques instants.</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      <label htmlFor="email">Ton adresse mail</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="toi@example.com"
        style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
      />
      <button type="submit" disabled={pending} style={{ padding: "8px 16px" }}>
        {pending ? "Envoi..." : "Recevoir mon lien de connexion"}
      </button>
      {state.status === "error" && <p style={{ color: "crimson" }}>{state.message}</p>}
    </form>
  );
}
