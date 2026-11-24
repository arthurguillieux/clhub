"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A photo picker that speaks French: the browser's own file field says « Choose File / No file
 * chosen » whatever the language of the page. The real input stays in the form (same name, id,
 * required), just visually hidden behind a button; once chosen, a small preview shows what will go.
 */
export function PhotoInput({
  id,
  name,
  multiple = false,
  required = false,
  label,
}: {
  id?: string;
  name: string;
  multiple?: boolean;
  required?: boolean;
  /** The button's words; « Choisir une photo » / « Choisir des photos » by default. */
  label?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const live = useRef<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  // A form that resets after sending (React does so after an action) empties the field: follow it.
  // And let go of the previews' memory when the picker leaves the page.
  useEffect(() => {
    const form = input.current?.form;
    const clear = () => pick(null);
    form?.addEventListener("reset", clear);
    return () => {
      form?.removeEventListener("reset", clear);
      live.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function pick(list: FileList | null) {
    const next = Array.from(list ?? []);
    live.current.forEach((u) => URL.revokeObjectURL(u));
    live.current = next.slice(0, 6).map((f) => URL.createObjectURL(f));
    setFiles(next);
    setPreviews(live.current);
  }

  const chosen = files.length === 0 ? "Aucune photo choisie" : files.length === 1 ? files[0]!.name : `${files.length} photos choisies`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-ink transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-ground hover:bg-primary/90">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
        {files.length ? (multiple ? "Changer les photos" : "Changer la photo") : (label ?? (multiple ? "Choisir des photos" : "Choisir une photo"))}
        <input
          ref={input}
          id={id}
          name={name}
          type="file"
          accept="image/*"
          multiple={multiple}
          required={required}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => pick(e.target.files)}
        />
      </label>
      <span className="min-w-0 truncate text-sm text-muted" aria-live="polite">
        {chosen}
      </span>
      {previews.length > 0 && (
        <span className="flex basis-full gap-2">
          {previews.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of a file not uploaded yet
            <img key={src} src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ))}
        </span>
      )}
    </div>
  );
}
