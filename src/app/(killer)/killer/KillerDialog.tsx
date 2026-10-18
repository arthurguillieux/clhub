"use client";

import { useEffect } from "react";

/** In-page confirmation: buttons say what they do, the safe one has focus, Escape closes. */
export function KillerDialog({
  title,
  detail,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(27,33,39,0.35)] p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="killer-panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-xl font-semibold">{title}</p>
        {detail && <p className="mt-2 text-sm text-[var(--k-muted)]">{detail}</p>}
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            className={`${danger ? "killer-btn-blood" : "killer-btn"} min-h-12 px-4`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
          <button type="button" className="killer-btn-ghost min-h-12 px-4" onClick={onClose} autoFocus>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
