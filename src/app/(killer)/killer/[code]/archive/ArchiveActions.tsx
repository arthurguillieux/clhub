"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteKillerGameAction, killerHostAction } from "../../actions";
import { KillerDialog } from "../../KillerDialog";

type Dialog = { title: string; detail: string; confirmLabel: string; cancelLabel: string; danger?: boolean; onConfirm: () => void };

/** The archive's tools: the photos (download, delete), back to « Tes parties », delete the game. */
export function ArchiveActions({ code, isCreator, hasPhotos }: { code: string; isCreator: boolean; hasPhotos: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState("");

  const run = async (action: unknown, then: () => void) => {
    setError("");
    const result = await killerHostAction(code, action).catch(() => ({ ok: false as const, error: "Pas de connexion — réessaie." }));
    if (!result.ok) return setError(result.error);
    then();
  };

  return (
    <section className="killer-panel flex flex-col gap-2 p-4">
      <p className="killer-label">Les photos</p>
      {hasPhotos ? (
        <>
          <a href={`/api/killer/${code}/photos`} download className="killer-btn-ghost flex min-h-12 items-center justify-center px-4">
            ⬇ Télécharger toutes les photos (.zip)
          </a>
          <button
            type="button"
            className="self-center py-2 text-xs text-[var(--k-muted)] underline"
            onClick={() =>
              setDialog({
                title: "Supprimer toutes les photos ?",
                detail: "Pense à les télécharger d'abord pour les envoyer aux joueurs. Les résultats et l'historique restent dans l'archive.",
                confirmLabel: "Supprimer toutes les photos",
                cancelLabel: "Garder les photos",
                danger: true,
                onConfirm: () => void run({ type: "removeAllPhotos" }, () => router.refresh()),
              })
            }
          >
            Supprimer toutes les photos
          </button>
        </>
      ) : (
        <p className="text-sm text-[var(--k-muted)]">Les photos de cette partie ont été supprimées.</p>
      )}

      <p className="killer-label mt-3">La partie</p>
      <button
        type="button"
        className="killer-btn-ghost min-h-12 px-4"
        onClick={() => void run({ type: "archive", archived: false }, () => router.push(`/killer/${code}/panneau`))}
      >
        Sortir des archives
      </button>
      {isCreator && (
        <button
          type="button"
          className="killer-btn-ghost min-h-12 px-4 text-[var(--k-alert)]"
          onClick={() =>
            setDialog({
              title: "Supprimer la partie ?",
              detail: "L'archive, les agents, leurs photos et l'historique sont effacés définitivement.",
              confirmLabel: "Supprimer la partie et les photos",
              cancelLabel: "Garder l'archive",
              danger: true,
              onConfirm: () => void deleteKillerGameAction(code),
            })
          }
        >
          Supprimer la partie (photos comprises)
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--k-alert)]">
          {error}
        </p>
      )}
      {dialog && <KillerDialog {...dialog} onClose={() => setDialog(null)} />}
    </section>
  );
}
