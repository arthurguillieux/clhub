"use client";

import { useTransition } from "react";
import { adminSetRoleAction } from "../actions";

export function RoleToggle({ memberId, role }: { memberId: string; role: string }) {
  const [pending, startTransition] = useTransition();
  const isAdmin = role === "admin";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => adminSetRoleAction(memberId, isAdmin ? "member" : "admin"))
      }
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50 ${
        isAdmin
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-line text-muted hover:bg-surface-raised"
      }`}
    >
      {pending ? "..." : isAdmin ? "Admin" : "Membre"}
    </button>
  );
}
