"use client";

import { useTransition } from "react";
import { recordSettlementAction } from "../actions";

export function QuickSettleButton({
  eventId,
  fromMemberId,
  toMemberId,
  amountCents,
}: {
  eventId: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("fromMemberId", fromMemberId);
        formData.set("toMemberId", toMemberId);
        formData.set("amount", (amountCents / 100).toFixed(2));
        startTransition(() => {
          recordSettlementAction(eventId, { status: "idle" }, formData);
        });
      }}
      className="rounded-md border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
    >
      {pending ? "..." : "Marquer réglé"}
    </button>
  );
}
