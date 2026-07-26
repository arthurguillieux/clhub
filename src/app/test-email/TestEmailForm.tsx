"use client";

import { useActionState } from "react";
import { submitTestEmail, type TestEmailFormState } from "./actions";

const initialState: TestEmailFormState = { status: "idle" };

export function TestEmailForm() {
  const [state, formAction, pending] = useActionState(submitTestEmail, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <label htmlFor="email">Adresse mail de destination</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        placeholder="toi@example.com"
        style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
      />
      <button type="submit" disabled={pending} style={{ padding: "8px 16px" }}>
        {pending ? "Envoi..." : "Envoyer le mail de test"}
      </button>

      {state.status === "success" && (
        <p style={{ color: "green" }}>
          Envoyé{state.id ? ` (id: ${state.id})` : ""}. Vérifie la boîte de réception (et les
          indésirables).
        </p>
      )}
      {state.status === "error" && <p style={{ color: "crimson" }}>Échec : {state.message}</p>}
    </form>
  );
}
