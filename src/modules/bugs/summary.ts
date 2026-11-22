import { BUG_STATUS_LABELS, type BugStatus } from "./labels";

export interface SummaryReport {
  page: string | null;
  message: string;
  userAgent: string | null;
  status: string;
  note: string | null;
  createdAt: Date;
  name: string | null;
}
export interface SummaryError {
  path: string | null;
  method: string | null;
  routeType: string | null;
  message: string;
  occurredAt: Date;
}

/** What Arthur pastes to Claude: the reports to look at, then the server's recent errors. Plain Markdown. */
export function forClaude(reports: SummaryReport[], errors: SummaryError[]): string {
  const when = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  const open = reports.filter((r) => r.status === "new" || r.status === "bug");
  const lines = ["# Signalements du CLHUB", ""];
  if (!open.length) lines.push("Aucun signalement ouvert.", "");
  for (const r of open) {
    lines.push(`## ${BUG_STATUS_LABELS[r.status as BugStatus] ?? r.status} · ${when(r.createdAt)} · ${r.name ?? "membre supprimé"}`);
    lines.push(`- Page : ${r.page ?? "?"}`);
    if (r.userAgent) lines.push(`- Navigateur : ${r.userAgent}`);
    if (r.note) lines.push(`- Note d'Arthur : ${r.note}`);
    lines.push("", r.message.split("\n").map((l) => `> ${l}`).join("\n"), "");
  }
  if (errors.length) {
    lines.push("# Dernières erreurs du serveur", "");
    for (const e of errors.slice(0, 15)) lines.push(`- ${when(e.occurredAt)} · ${e.method ?? ""} ${e.path ?? ""} (${e.routeType ?? "?"}) : ${e.message.slice(0, 300)}`);
  }
  return lines.join("\n");
}
