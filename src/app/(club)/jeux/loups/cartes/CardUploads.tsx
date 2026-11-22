"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callError } from "@/core/ui/callError";
import { cardArtAction } from "@/app/(loups)/loups/actions";
import { CardBack, CardFace } from "@/app/(loups)/loups/Card";

/** Shrinks a photo in the browser before it leaves (a card is 720 × 1008 at most): light on the NAS and the network. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 720 / bitmap.width, 1008 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image"))), "image/jpeg", 0.9));
}

export function CardUploads({ art, faces }: { art: Record<string, string>; faces: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const send = async (face: string, file: File | null) => {
    setBusy(face);
    setError("");
    try {
      const data = new FormData();
      data.set("face", face);
      if (file) data.set("file", await shrink(file), `${face}.jpg`);
      else data.set("remove", "1");
      const result = await cardArtAction(data);
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message === "image" ? "Cette image n'a pas pu être lue." : callError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--w-blood)]">
          {error}
        </p>
      )}
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {faces.map((f) => (
          <li key={f.id} className="flex flex-col gap-2">
            <div className="text-[9px]">{f.id === "verso" ? <CardBack art={art} /> : <CardFace role={f.id} art={art} />}</div>
            <p className="loups-label text-[0.7rem]">{f.name}</p>
            <label className={`loups-btn min-h-10 cursor-pointer px-2 text-xs ${busy ? "opacity-50" : ""}`}>
              {busy === f.id ? "Envoi…" : art[f.id] ? "Changer l'image" : "Choisir une image"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={!!busy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (file) void send(f.id, file);
                }}
              />
            </label>
            {art[f.id] && (
              <button type="button" className="loups-muted py-1 text-xs underline" disabled={!!busy} onClick={() => void send(f.id, null)}>
                Revenir au dessin du CLHUB
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
