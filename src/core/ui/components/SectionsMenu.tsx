"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CLUB_SECTIONS, POLES } from "@/core/ui/sections";
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
        <div className="absolute left-0 z-40 mt-2 w-72 rounded-2xl border border-line bg-surface-raised p-1.5 shadow-lg">
          {/* The five verbs, each with its modules under it. */}
          {POLES.map((pole) => (
            <div key={pole.id} className="py-0.5">
              <Link href={pole.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink hover:bg-surface">
                <SectionTile id={pole.id} size={32} />
                {pole.name}
              </Link>
              <div className="flex flex-wrap gap-x-3 pb-1 pl-[3.25rem] text-xs">
                {(pole.links ?? CLUB_SECTIONS.filter((s) => s.pole === pole.id && s.live && s.href).map((s) => ({ label: s.short, href: s.href! }))).map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-1 text-muted hover:text-ink">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
