"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { POLES, poleOfPath } from "@/core/ui/sections";
import { SectionTile } from "./SectionIcon";

/**
 * On a phone, the club is five verbs at the thumb: Partager, Manger, Se retrouver, Jouer, Célébrer.
 * The one you're in is ringed in its colour. Hidden from md up, where the header carries them.
 */
export function BottomNav() {
  const here = poleOfPath(usePathname());
  return (
    <nav aria-label="Le club" className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-ground/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden print:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {POLES.map((p) => {
          const on = here === p.id;
          return (
            <Link key={p.id} href={p.href} aria-current={on ? "page" : undefined} className="flex flex-col items-center gap-1 text-[11px] font-medium text-muted">
              <span className={`rounded-[15px] transition-transform ${on ? "scale-105 ring-2 ring-offset-2 ring-offset-ground" : "opacity-90"}`} style={on ? ({ ["--tw-ring-color" as string]: p.color } as React.CSSProperties) : undefined}>
                <SectionTile id={p.id} size={46} />
              </span>
              <span className={`whitespace-nowrap ${on ? "text-ink" : ""}`}>{p.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
