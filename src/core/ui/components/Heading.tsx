import type { SectionId } from "@/core/ui/sections";
import { SectionTile } from "./SectionIcon";

/** A page's title; in a section, with its colour tile in front, as in the shortcut bar. */
export function PageTitle({ children, section }: { children: React.ReactNode; section?: SectionId }) {
  const title = <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink text-balance">{children}</h1>;
  if (!section) return title;
  return (
    <div className="flex items-center gap-3">
      <SectionTile id={section} size={44} />
      {title}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-extrabold text-ink">{children}</h2>;
}

/** A small uppercase label above a group, as on the home page (« Pour toi », « Dans le club »). */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{children}</h2>;
}
