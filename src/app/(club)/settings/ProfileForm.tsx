"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = { status: "idle" };

export function ProfileForm({ bio, phone }: { bio: string | null; phone: string | null }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <label htmlFor="bio">Bio</label>
      <textarea
        id="bio"
        name="bio"
        defaultValue={bio ?? ""}
        rows={3}
        style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
      />
      <label htmlFor="phone">Téléphone</label>
      <input
        id="phone"
        name="phone"
        type="tel"
        defaultValue={phone ?? ""}
        style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
      />
      <button type="submit" disabled={pending} style={{ padding: "8px 16px" }}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
      {state.status === "success" && <p style={{ color: "green" }}>Enregistré.</p>}
      {state.status === "error" && <p style={{ color: "crimson" }}>{state.message}</p>}
    </form>
  );
}
