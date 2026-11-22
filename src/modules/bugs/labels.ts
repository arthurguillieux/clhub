/** The verdicts on a report, shared by the server and the admin page. */
export const BUG_STATUSES = ["new", "bug", "notabug", "fixed"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];
export const BUG_STATUS_LABELS: Record<BugStatus, string> = { new: "Nouveau", bug: "Bug confirmé", notabug: "Pas un bug", fixed: "Corrigé" };
