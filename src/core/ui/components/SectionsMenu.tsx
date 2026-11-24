"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CLUB_SECTIONS } from "@/core/ui/sections";
import { SectionTile } from "./SectionIcon";

export function SectionsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="-mx-1 -my-2.5 flex items-center gap-1 px-1 py-2.5 text-sm font-medium text-muted hover:text-ink"
      >
        Sections
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-64 rounded-2xl border border-line bg-surface-raised p-1.5 shadow-lg">
          {CLUB_SECTIONS.map((section) =>
            section.live && section.href ? (
              <Link
                key={section.name}
                href={section.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-ink hover:bg-surface"
              >
                <SectionTile id={section.id} size={32} />
                {section.name}
              </Link>
            ) : (
              <div
                key={section.name}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-muted opacity-60"
              >
                <span>{section.name}</span>
                <span className="rounded-full border border-line-soft px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
                  À venir
                </span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
