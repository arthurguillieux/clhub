"use client";

import { useTransition } from "react";
import { adminReassignItemAction } from "../actions";

export function ReassignItemForm({
  itemId,
  currentOwnerId,
  members,
}: {
  itemId: string;
  currentOwnerId: string;
  members: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentOwnerId}
      disabled={pending}
      onChange={(e) => startTransition(() => adminReassignItemAction(itemId, e.target.value))}
      className="rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-ink disabled:opacity-50"
    >
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name || "Membre"}
        </option>
      ))}
    </select>
  );
}
