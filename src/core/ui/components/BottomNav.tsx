"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CLUB_SECTIONS, SHORTCUTS, sectionById } from "@/core/ui/sections";
import { Glyph, SectionTile } from "./SectionIcon";

/**
 * On a phone, the sections live at the thumb: the four reached most as colour shortcuts, the rest
 * behind « Tout ». Hidden from md up, where the header carries them.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const here = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav aria-label="Les sections du club" className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-ground/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden print:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {SHORTCUTS.map((id) => {
            const s = sectionById(id);
            const on = here(s.href!);
            return (
              <Link key={id} href={s.href!} aria-current={on ? "page" : undefined} className="flex flex-col items-center gap-1 text-[11px] font-medium text-muted">
                <span className={`rounded-[15px] transition-transform ${on ? "scale-105 ring-2 ring-offset-2 ring-offset-ground" : "opacity-90"}`} style={on ? ({ ["--tw-ring-color" as string]: s.color } as React.CSSProperties) : undefined}>
                  <SectionTile id={id} size={46} />
                </span>
                <span className={on ? "text-ink" : ""}>{s.short}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className="flex flex-col items-center gap-1 text-[11px] font-medium text-muted">
            <span className="grid h-[46px] w-[46px] place-items-center rounded-[15px] border border-line bg-surface-raised text-ink">
              <Glyph name="tout" />
            </span>
            Tout
          </button>
        </div>
      </nav>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Tout le club" className="fixed inset-0 z-50 flex items-end bg-black/60 md:hidden" onClick={() => setOpen(false)}>
          <div className="w-full rounded-t-3xl border-t border-line bg-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <p className="font-display text-xl font-extrabold">Tout le club</p>
              <button type="button" onClick={() => setOpen(false)} className="-my-2 rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-ink">
                Fermer
              </button>
            </div>
            <ul className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4">
              {CLUB_SECTIONS.filter((s) => s.live && s.href).map((s) => (
                <li key={s.id}>
                  <Link href={s.href!} onClick={() => setOpen(false)} className="flex flex-col items-center gap-1.5 text-center text-xs text-ink">
                    <SectionTile id={s.id} size={56} />
                    {s.short}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/membres" onClick={() => setOpen(false)} className="flex flex-col items-center gap-1.5 text-center text-xs text-ink">
                  <span className="grid h-14 w-14 place-items-center rounded-[17px] border border-line bg-surface-raised">
                    <Glyph name="membres" size={28} />
                  </span>
                  Membres
                </Link>
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line-soft pt-4 text-sm">
              <Link href="/" onClick={() => setOpen(false)} className="rounded-full border border-line px-3 py-2 text-ink">
                Accueil
              </Link>
              <Link href="/nouveautes" onClick={() => setOpen(false)} className="rounded-full border border-line px-3 py-2 text-ink">
                Nouveautés
              </Link>
              <Link href="/invite" onClick={() => setOpen(false)} className="rounded-full border border-line px-3 py-2 text-ink">
                Inviter quelqu&apos;un
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
