"use client";

import { useActionState } from "react";
import { submitInvite, type InviteFormState } from "./actions";

const initialState: InviteFormState = { status: "idle" };

export function InviteForm() {
  const [state, formAction, pending] = useActionState(submitInvite, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <label htmlFor="email">Adresse mail à inviter</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        placeholder="pote@example.com"
        style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
      />
      <button type="submit" disabled={pending} style={{ padding: "8px 16px" }}>
        {pending ? "Envoi..." : "Inviter"}
      </button>

      {state.status === "success" && (
        <div style={{ color: "green" }}>
          <p>Invitation envoyée. Lien (utile tant que Resend n&apos;est pas configuré) :</p>
          <code style={{ wordBreak: "break-all" }}>{state.url}</code>
        </div>
      )}
      {state.status === "error" && <p style={{ color: "crimson" }}>{state.message}</p>}
    </form>
  );
}
