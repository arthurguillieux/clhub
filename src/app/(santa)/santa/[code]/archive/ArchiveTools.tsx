"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSantaAction, santaArchiveDrawAction, santaNextYearAction, santaOrgAction } from "../../actions";
import { SantaDialog } from "../../SantaDialog";

/** The draw stays masked here too, until asked for; then next year, out of the archives, delete. */
export function ArchiveTools({ code, isCreator }: { code: string; isCreator: boolean }) {
  const router = useRouter();
  const [pairs, setPairs] = useState<{ giver: string; recipient: string }[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <section className="santa-panel p-4">
        <p className="santa-label">Le tirage</p>
        {pairs ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {pairs.map((p) => (
              <li key={p.giver}>
                <b>{p.giver}</b> a offert à <b className="text-[var(--s-green)]">{p.recipient}</b>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--s-muted)]">Toujours masqué. Maintenant que les cadeaux sont ouverts, tu peux le découvrir.</p>
            <button type="button" className="santa-btn-ghost mt-3 min-h-11 px-4 text-sm" onClick={async () => setPairs(await santaArchiveDrawAction(code))}>
              🎭 Démasquer le tirage
            </button>
          </>
        )}
      </section>

      <button
        type="button"
        className="santa-btn min-h-12 px-4"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void santaNextYearAction(code);
        }}
      >
        {busy ? "Préparation…" : "🎄 Refaire pour l'année suivante"}
      </button>
      <p className="santa-note -mt-3 mx-auto w-fit text-center text-xs text-[var(--s-muted)]">Mêmes participants et mêmes exclusions, et le tirage évitera de refaire celui-ci.</p>
      <button
        type="button"
        className="santa-btn-ghost min-h-12 px-4"
        onClick={async () => {
          const result = await santaOrgAction(code, { type: "archive", archived: false });
          if (result.ok) router.push(`/santa/${code}/panneau`);
        }}
      >
        Sortir des archives
      </button>
      {isCreator && (
        <button type="button" className="santa-btn-ghost min-h-12 px-4 text-[var(--s-red)]" onClick={() => setConfirmDelete(true)}>
          Supprimer ce Secret Santa
        </button>
      )}
      {confirmDelete && (
        <SantaDialog
          title="Supprimer ce Secret Santa ?"
          detail="Participants, tirage, lettres et questions sont effacés définitivement, et il ne pourra plus servir à éviter les mêmes tirages l'an prochain."
          confirmLabel="Supprimer définitivement"
          cancelLabel="Garder"
          danger
          onConfirm={() => void deleteSantaAction(code)}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
