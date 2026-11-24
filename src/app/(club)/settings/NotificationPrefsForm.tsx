"use client";

import { useActionState } from "react";
import { NOTIFICATION_CATEGORIES, wantsEmail } from "@/core/notifications/preferences";
import { updateNotifPrefsAction, type NotifPrefsState } from "./actions";

const initialState: NotifPrefsState = { status: "idle" };

export function NotificationPrefsForm({ notifPrefs }: { notifPrefs: unknown }) {
  const [state, formAction, pending] = useActionState(updateNotifPrefsAction, initialState);

  return (
    <form
      action={formAction}
      // Saved as soon as a box is ticked: no « Enregistrer » to forget.
      onChange={(e) => e.currentTarget.requestSubmit()}
      className="flex flex-col gap-3"
    >
      {NOTIFICATION_CATEGORIES.map((category) => (
        <label
          key={category.key}
          htmlFor={`notif-${category.key}`}
          className="flex items-start gap-3 rounded-md border border-line p-3"
        >
          <input
            id={`notif-${category.key}`}
            type="checkbox"
            name={category.key}
            defaultChecked={wantsEmail(notifPrefs, category.key)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{category.label}</span>
            <span className="block text-xs text-muted">{category.description}</span>
          </span>
        </label>
      ))}

      <p aria-live="polite" className="min-h-5 text-sm">
        {pending ? (
          <span className="text-muted">Enregistrement…</span>
        ) : state.status === "success" ? (
          <span className="text-green-700 dark:text-green-400">Enregistré ✓</span>
        ) : state.status === "error" ? (
          <span className="text-red-600 dark:text-red-400">{state.message}</span>
        ) : (
          <span className="text-muted">Chaque case s&apos;enregistre dès que tu la coches.</span>
        )}
      </p>
    </form>
  );
}
