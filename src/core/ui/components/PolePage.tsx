import Link from "next/link";
import { CLUB_SECTIONS, poleById, type PoleId } from "@/core/ui/sections";
import { Container } from "./Container";
import { SectionTile } from "./SectionIcon";

/** A pole's header: its tile, its verb, its line. */
export function PoleHeader({ pole }: { pole: PoleId }) {
  const p = poleById(pole);
  return (
    <header className="flex items-center gap-3.5">
      <SectionTile id={pole} size={52} />
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">{p.name}</h1>
        <p className="text-sm text-muted">{p.tagline}</p>
      </div>
    </header>
  );
}

/**
 * A pole's page (Partager, Manger, Se retrouver): its modules as big cards, each with what it's for
 * and the one thing people come to do there.
 */
export function PolePage({ pole, children }: { pole: PoleId; children?: React.ReactNode }) {
  const p = poleById(pole);
  const modules = CLUB_SECTIONS.filter((s) => s.pole === pole && s.live && s.href);
  return (
    <Container size="md">
      <PoleHeader pole={pole} />
      {children}
      <ul className="mt-6 flex flex-col gap-3">
        {modules.map((m) => (
          <li key={m.id} className="rounded-card border bg-surface" style={{ borderColor: `color-mix(in srgb, ${p.color} 30%, var(--line))` }}>
            <Link href={m.href!} className="flex items-center gap-3.5 p-4">
              <SectionTile id={m.id} size={52} />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-extrabold text-ink">{m.name}</span>
                <span className="block text-sm text-muted">{m.description}</span>
              </span>
              <span className="text-muted" aria-hidden="true">
                ›
              </span>
            </Link>
            {m.action && (
              <div className="border-t border-line-soft px-4 py-2.5">
                <Link href={m.action.href} className="inline-flex min-h-10 items-center text-sm font-semibold" style={{ color: p.color }}>
                  + {m.action.label}
                </Link>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Container>
  );
}
