"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "@/core/ui/components/Toaster";
import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import type { EditionView } from "@/modules/nouvel-an/data";
import type { Answer } from "@/modules/nouvel-an/domain/plan";
import type { NyeResult } from "../actions";

export type Run = (input: Record<string, unknown>, success?: string) => Promise<boolean>;

/** The edition on screen, and one way to change it: every call answers with the edition as it now is. */
export function useNye(initial: EditionView, call: (input: Record<string, unknown>) => Promise<NyeResult>) {
  const [view, setView] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run: Run = (input, success) =>
    new Promise((resolve) =>
      start(async () => {
        setError(null);
        const r = await call(input);
        if (!r.ok) {
          setError(r.error);
          resolve(false);
          return;
        }
        setView(r.view);
        if (r.info || success) toast(r.info ?? success ?? "");
        resolve(true);
      }),
    );
  return { view, pending, error, run };
}

export const ANSWERS: { id: Answer; label: string; short: string }[] = [
  { id: "yes", label: "Je viens", short: "vient" },
  { id: "maybe", label: "Peut-être", short: "peut-être" },
  { id: "no", label: "Je ne viens pas", short: "ne vient pas" },
  { id: "pending", label: "Pas encore répondu", short: "pas répondu" },
];

const DAY = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
/** « mer. 31 déc. » */
export const dayLabel = (d: string) => DAY.format(new Date(`${d}T12:00:00Z`));

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-ink">
      {error}
    </p>
  );
}

/** A choice among a few, as round buttons (the answer, a mission's progress). */
export function Choice<T extends string>({ value, options, onChange, disabled, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${value === o.id ? "border-primary bg-primary text-primary-ink" : "border-line text-ink hover:bg-surface"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The days someone is there, as toggles: all of them by default. */
export function DayToggles({ days, value, onChange, disabled }: { days: string[]; value: string[] | null; onChange: (v: string[] | null) => void; disabled?: boolean }) {
  const on = (d: string) => !value || value.includes(d);
  return (
    <div role="group" aria-label="Les jours" className="flex flex-wrap gap-2">
      {days.map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          aria-pressed={on(d)}
          onClick={() => {
            const next = days.filter((x) => (x === d ? !on(d) : on(x)));
            if (next.length) onChange(next.length === days.length ? null : next);
          }}
          className={`min-h-10 rounded-full border px-3 text-sm ${on(d) ? "border-primary/60 bg-primary/15 text-ink" : "border-line text-muted line-through"}`}
        >
          {dayLabel(d)}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "ok" | "warn" | "bad" }) {
  const tones = { plain: "border-line text-muted", ok: "border-emerald-500/50 text-ink bg-emerald-500/10", warn: "border-amber-500/50 text-ink bg-amber-500/10", bad: "border-red-500/50 text-ink bg-red-500/10" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

/** A small text button, for the secondary gestures. */
export function TextButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="min-h-10 py-1 text-sm text-muted underline underline-offset-2 hover:text-ink disabled:opacity-50" {...props}>
      {children}
    </button>
  );
}

/** « Retirer… » with its confirmation, named after what it does. */
export function Remove({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void | Promise<unknown> }) {
  return <ConfirmDeleteButton quiet triggerLabel={label} question={`${confirmLabel} ?`} confirmLabel={confirmLabel} keepLabel="Garder" onConfirm={onConfirm} />;
}
