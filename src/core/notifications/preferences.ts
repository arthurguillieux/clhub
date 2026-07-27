/**
 * Categories a member can opt out of, by mail only — the in-app
 * notification (flux, cloche) is always created regardless, this only
 * gates the extra step of sending an email on top of it. New email types
 * (e.g. task #9's overdue reminders) register themselves here rather than
 * checking prefs ad hoc at each call site.
 */
export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "bookingRequest",
    label: "Demande de prêt",
    description:
      "Un mail quand quelqu'un demande à emprunter un de tes objets, avec les liens pour valider ou refuser en un clic.",
  },
  {
    key: "overdueReminder",
    label: "Retard de retour",
    description: "Un mail si un emprunt en cours dépasse sa date de retour prévue.",
  },
];

/** Opt-out model: absent or anything but an explicit `false` counts as "wants it". */
export function wantsEmail(notifPrefs: unknown, categoryKey: string): boolean {
  if (typeof notifPrefs !== "object" || notifPrefs === null) return true;
  const value = (notifPrefs as Record<string, unknown>)[categoryKey];
  return value !== false;
}
