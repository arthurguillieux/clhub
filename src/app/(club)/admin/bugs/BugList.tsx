"use client";

import { useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { Select, Textarea } from "@/core/ui/components/Field";
import { callError } from "@/core/ui/callError";
import { BUG_STATUS_LABELS, BUG_STATUSES, type BugStatus } from "@/modules/bugs/labels";
import { bugStatusAction, claudeSummaryAction, deleteBugAction } from "./actions";

type Report = { id: string; page: string | null; message: string; userAgent: string | null; status: string; note: string | null; name: string | null; when: string };

const TONE: Record<BugStatus, string> = {
  new: "bg-accent text-accent-ink",
  bug: "bg-red-600 text-white",
  notabug: "bg-surface text-muted border border-line",
  fixed: "bg-primary text-primary-ink",
};

/** « Copier pour Claude »: the open reports and the server's errors, in the clipboard. */
export function CopyForClaude() {
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          try {
            await navigator.clipboard.writeText(await claudeSummaryAction());
            setState("done");
          } catch (e) {
            setState(callError(e));
          }
        }}
      >
        {state === "busy" ? "Préparation…" : "📋 Copier pour Claude"}
      </Button>
      {state === "done" && <span className="text-sm text-muted">Copié : colle-le dans la conversation avec Claude.</span>}
      {state !== "idle" && state !== "busy" && state !== "done" && <span className="text-sm text-red-600">{state}</span>}
    </div>
  );
}

export function BugList({ reports }: { reports: Report[] }) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const shown = reports.filter((r) => filter === "all" || r.status === "new" || r.status === "bug");
  return (
    <>
      <div className="mt-3 flex gap-2 text-sm">
        {(["open", "all"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 ${filter === f ? "bg-primary text-primary-ink" : "border border-line text-muted"}`}>
            {f === "open" ? `À traiter (${reports.filter((r) => r.status === "new" || r.status === "bug").length})` : `Tous (${reports.length})`}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{filter === "open" ? "Rien à traiter." : "Aucun signalement pour l'instant."}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {shown.map((r) => (
            <BugItem key={r.id} report={r} />
          ))}
        </ul>
      )}
    </>
  );
}

function BugItem({ report }: { report: Report }) {
  const [status, setStatus] = useState(report.status as BugStatus);
  const [note, setNote] = useState(report.note ?? "");
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  const dirty = status !== report.status || note !== (report.note ?? "");
  if (gone) return null;
  return (
    <li className="rounded-md border border-line bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${TONE[report.status as BugStatus] ?? ""}`}>{BUG_STATUS_LABELS[report.status as BugStatus] ?? report.status}</span>
        <span>
          {report.when} · {report.name ?? "membre supprimé"}
          {report.page ? ` · ${report.page}` : ""}
        </span>
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap text-ink">{report.message}</p>
      {report.userAgent && <p className="mt-1 truncate text-[11px] text-muted">{report.userAgent}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr]">
        <Select aria-label="Verdict" value={status} onChange={(e) => setStatus(e.target.value as BugStatus)}>
          {BUG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BUG_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Textarea aria-label="Ta note" value={note} onChange={(e) => setNote(e.target.value)} rows={1} className="min-h-10" placeholder="Ta note (facultative)" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy || !dirty}
          onClick={async () => {
            setBusy(true);
            await bugStatusAction({ id: report.id, status, note: note || null }).finally(() => setBusy(false));
          }}
        >
          {dirty ? "Enregistrer le verdict" : "Enregistré ✓"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await deleteBugAction(report.id).finally(() => setBusy(false));
            if (r.ok) setGone(true);
          }}
        >
          Supprimer
        </Button>
      </div>
    </li>
  );
}
