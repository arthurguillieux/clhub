"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/core/ui/components/Button";
import { Textarea } from "@/core/ui/components/Field";
import { reportIssueAction, resolveMaintenanceAction, type ReportIssueState } from "./actions";

const initialState: ReportIssueState = { status: "idle" };

export function MaintenanceForm({
  itemId,
  itemSlug,
  canManage,
  isBroken,
}: {
  itemId: string;
  itemSlug: string;
  canManage: boolean;
  isBroken: boolean;
}) {
  const reportAction = reportIssueAction.bind(null, itemId, itemSlug);
  const [reportState, reportFormAction, reportPending] = useActionState(reportAction, initialState);
  const resolveAction = resolveMaintenanceAction.bind(null, itemId, itemSlug);
  const [resolveState, resolveFormAction, resolvePending] = useActionState(
    resolveAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (reportState.status === "success" || resolveState.status === "success") {
      formRef.current?.reset();
    }
  }, [reportState, resolveState]);

  if (isBroken) {
    if (!canManage) {
      return (
        <p className="mt-4 text-sm text-muted">
          Le propriétaire a été prévenu — l&apos;objet redeviendra disponible une fois réparé.
        </p>
      );
    }
    return (
      <form ref={formRef} action={resolveFormAction} className="mt-4 flex flex-col gap-2">
        <Textarea name="note" rows={2} placeholder="Ce qui a été fait pour réparer..." required />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={resolvePending} variant="accent" className="self-start">
            {resolvePending ? "Envoi..." : "Marquer comme réparé"}
          </Button>
          {resolveState.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">{resolveState.message}</p>
          )}
        </div>
      </form>
    );
  }

  return (
    <form ref={formRef} action={reportFormAction} className="mt-4 flex flex-col gap-2">
      <Textarea name="note" rows={2} placeholder="Décris le problème rencontré..." required />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={reportPending} variant="ghost" className="self-start">
          {reportPending ? "Envoi..." : "Signaler un problème"}
        </Button>
        {reportState.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{reportState.message}</p>
        )}
      </div>
    </form>
  );
}
