"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { Glyph } from "@/core/ui/components/SectionIcon";
import { PhotoInput } from "@/core/ui/components/PhotoInput";
import {
  deleteItemPhotoAction,
  moveItemPhotoAction,
  setPrimaryPhotoAction,
  uploadItemPhotosAction,
  type PhotoGalleryState,
} from "./actions";

interface Photo {
  id: string;
  path: string;
  isPrimary: boolean;
}

const initialState: PhotoGalleryState = { status: "idle" };

/** What everyone sees: the big photo, and the others to tap through when there are several. */
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(photos[0]?.id ?? null);
  const selected = photos.find((p) => p.id === selectedId) ?? photos[0] ?? null;

  if (!selected) {
    // No photo yet: a quiet band, not a big block of colour.
    return (
      <div className="grid h-28 place-items-center bg-surface-raised text-muted/60">
        <Glyph name="pretotheque" size={36} />
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[4/3] max-h-80 w-full bg-surface-raised sm:aspect-[16/9]">
        {/* eslint-disable-next-line @next/next/no-img-element -- item hero photo */}
        <img src={selected.path} alt="" className="h-full w-full object-cover" />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-line-soft p-3">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedId(photo.id)}
              aria-label={`Voir la photo ${i + 1}`}
              aria-pressed={photo.id === selected.id}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${photo.id === selected.id ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail */}
              <img src={photo.path} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The owner's side, under « Gérer cet objet »: add photos, choose the main one, reorder, remove. */
export function PhotoManager({ itemId, itemSlug, photos }: { itemId: string; itemSlug: string; photos: Photo[] }) {
  const uploadAction = uploadItemPhotosAction.bind(null, itemId, itemSlug);
  const [uploadState, uploadFormAction, uploadPending] = useActionState(uploadAction, initialState);
  const small = "grid h-9 w-9 place-items-center rounded-lg border border-line text-sm text-muted hover:bg-surface hover:text-ink";

  return (
    <div className="flex flex-col gap-4">
      {photos.length > 0 && (
        <ul className="flex flex-col gap-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail */}
              <img src={photo.path} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              <div className="flex flex-wrap items-center gap-2">
                {photo.isPrimary ? (
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">Photo principale</span>
                ) : (
                  <button type="button" onClick={() => setPrimaryPhotoAction(itemId, itemSlug, photo.id)} className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold text-ink hover:bg-surface">
                    En faire la photo principale
                  </button>
                )}
                {index > 0 && (
                  <button type="button" aria-label="Avancer cette photo" title="Avancer" onClick={() => moveItemPhotoAction(itemId, itemSlug, photo.id, "up")} className={small}>
                    ←
                  </button>
                )}
                {index < photos.length - 1 && (
                  <button type="button" aria-label="Reculer cette photo" title="Reculer" onClick={() => moveItemPhotoAction(itemId, itemSlug, photo.id, "down")} className={small}>
                    →
                  </button>
                )}
                <ConfirmDeleteButton
                  question="Retirer cette photo ?"
                  confirmLabel="Retirer la photo"
                  keepLabel="Garder la photo"
                  triggerLabel="Retirer"
                  pendingLabel="Retrait…"
                  quiet
                  onConfirm={() => deleteItemPhotoAction(itemId, itemSlug, photo.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <form action={uploadFormAction} className="flex flex-wrap items-center gap-3">
        <PhotoInput name="photos" multiple />
        <Button type="submit" variant="ghost" disabled={uploadPending}>
          {uploadPending ? "Envoi…" : "Ajouter ces photos"}
        </Button>
        {uploadState.status === "error" && <p className="basis-full text-sm text-red-600 dark:text-red-400">{uploadState.message}</p>}
      </form>
    </div>
  );
}
