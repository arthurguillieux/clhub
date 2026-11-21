"use client";

import { useEffect, type ReactNode } from "react";
import type { HostView } from "@/modules/loups/views";

export type Send = (action: Record<string, unknown>) => Promise<string | null>;
export type SeatView = HostView["seats"][number];

/** An in-page dialog: buttons say what they do, Escape and the veil close it. */
export function LoupsDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="loups-veil fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" onClick={onClose}>
      <div className="loups-panel max-h-[92dvh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <p className="loups-title text-xl">{title}</p>
        <div className="mt-3 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

/** A player to pick among the seats; `none` adds an empty choice with that label. */
export function SeatSelect({
  seats,
  value,
  onChange,
  label,
  none = "Choisir…",
  disabled = false,
}: {
  seats: SeatView[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  none?: string;
  disabled?: boolean;
}) {
  return (
    <select aria-label={label} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} className="loups-field min-h-11 w-full px-3">
      <option value="">{none}</option>
      {seats.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export const nameOf = (seats: SeatView[], id: string | null | undefined) => seats.find((s) => s.id === id)?.name ?? "?";
