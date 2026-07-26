"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
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

export function PhotoGallery({
  itemId,
  itemSlug,
  categoryBg,
  photos,
  isOwner,
}: {
  itemId: string;
  itemSlug: string;
  categoryBg: string;
  photos: Photo[];
  isOwner: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(photos[0]?.id ?? null);
  const uploadAction = uploadItemPhotosAction.bind(null, itemId, itemSlug);
  const [uploadState, uploadFormAction, uploadPending] = useActionState(uploadAction, initialState);

  const selected = photos.find((p) => p.id === selectedId) ?? photos[0] ?? null;

  return (
    <div>
      <div className={`relative h-56 ${categoryBg}`}>
        {selected && (
          // eslint-disable-next-line @next/next/no-img-element -- item hero photo
          <img src={selected.path} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      {(photos.length > 1 || isOwner) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft bg-surface p-3">
          {photos.map((photo, index) => (
            <div key={photo.id} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedId(photo.id)}
                className={`relative h-14 w-14 overflow-hidden rounded-md border-2 ${
                  photo.id === selected?.id ? "border-primary" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail */}
                <img src={photo.path} alt="" className="h-full w-full object-cover" />
                {photo.isPrimary && (
                  <span className="absolute top-0.5 right-0.5 rounded-full bg-accent px-1 text-[9px] leading-tight text-accent-ink">
                    ★
                  </span>
                )}
              </button>
              {isOwner && (
                <div className="flex gap-1.5 text-[11px] text-muted">
                  {!photo.isPrimary && (
                    <button
                      type="button"
                      title="Définir comme principale"
                      onClick={() => setPrimaryPhotoAction(itemId, itemSlug, photo.id)}
                      className="hover:text-ink"
                    >
                      ★
                    </button>
                  )}
                  {index > 0 && (
                    <button
                      type="button"
                      title="Déplacer vers la gauche"
                      onClick={() => moveItemPhotoAction(itemId, itemSlug, photo.id, "up")}
                      className="hover:text-ink"
                    >
                      ←
                    </button>
                  )}
                  {index < photos.length - 1 && (
                    <button
                      type="button"
                      title="Déplacer vers la droite"
                      onClick={() => moveItemPhotoAction(itemId, itemSlug, photo.id, "down")}
                      className="hover:text-ink"
                    >
                      →
                    </button>
                  )}
                  <button
                    type="button"
                    title="Supprimer"
                    onClick={() => deleteItemPhotoAction(itemId, itemSlug, photo.id)}
                    className="hover:text-red-600 dark:hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <form
          action={uploadFormAction}
          className="flex flex-wrap items-center gap-3 border-b border-line-soft p-3"
        >
          <input
            type="file"
            name="photos"
            accept="image/*"
            multiple
            className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-ink"
          />
          <Button type="submit" variant="ghost" disabled={uploadPending}>
            {uploadPending ? "Envoi..." : "Ajouter des photos"}
          </Button>
          {uploadState.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">{uploadState.message}</p>
          )}
        </form>
      )}
    </div>
  );
}
