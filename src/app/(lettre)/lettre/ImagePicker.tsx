"use client";

import { useRef, useState } from "react";

/** The longest side a picture keeps once in the browser: plenty for a phone screen, light to send. */
const MAX_SIDE = 1200;

/** Under the 1 MB a server action accepts, with room to spare. */
const MAX_DATA_URL = 900_000;

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Some browsers decode what <img> can show but createImageBitmap can't (HEIC on Safari, say).
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** A phone photo made light: upright, 1200 px at most, JPEG on white (a shop's transparent PNG doesn't turn black). */
export async function shrinkImage(file: File): Promise<string> {
  const image = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  let quality = 0.86;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > MAX_DATA_URL && quality > 0.4) {
    quality -= 0.15;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  return url;
}

/**
 * Choose a photo, shown at once; `onPick` gets it ready to send. `round` frames it like the child's
 * portrait, otherwise like a gift on white.
 */
export function ImagePicker({
  current,
  label,
  busy = false,
  onPick,
  onRemove,
}: {
  current: string | null;
  /** What the picture is, for the buttons: « la photo d'Arès », « la photo du cadeau ». */
  label: string;
  busy?: boolean;
  onPick: (dataUrl: string) => void | Promise<unknown>;
  onRemove?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="flex items-center gap-3">
      <div className="lettre-photo h-20 w-20 shrink-0">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own route, already resized
          <img src={current} alt="" />
        ) : (
          <span aria-hidden="true" className="flex h-full items-center justify-center text-2xl text-[var(--s-muted)]">
            📷
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <button type="button" className="santa-btn-ghost min-h-11 px-3 text-sm" disabled={busy || working} onClick={() => input.current?.click()}>
          {working ? "Préparation…" : current ? `Changer ${label}` : `Choisir ${label}`}
        </button>
        {current && onRemove && (
          <button type="button" className="-my-1 py-1 text-xs text-[var(--s-muted)] underline" disabled={busy || working} onClick={onRemove}>
            Retirer {label}
          </button>
        )}
        {error && (
          <p role="alert" className="text-xs text-[var(--s-red)]">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Choisir ${label}`}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError("");
          setWorking(true);
          try {
            await onPick(await shrinkImage(file));
          } catch {
            setError("Cette image ne s'ouvre pas : essaie une photo en JPEG ou en PNG.");
          } finally {
            setWorking(false);
          }
        }}
      />
    </div>
  );
}
