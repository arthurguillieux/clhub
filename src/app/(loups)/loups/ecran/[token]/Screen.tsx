"use client";

import { useEffect, useRef, useState } from "react";
import { WINNER_LABELS, phaseLabel } from "@/modules/loups/domain/game";
import type { ScreenView } from "@/modules/loups/views";
import { screenAction } from "../../actions";
import { CardFace, Reveal } from "../../Card";

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The poster, alive: the table (the dead struck out, their card shown), the cards still in play, the
 * time of the game, the QR code when the CLHUB deals. Black and rust at night. A revealed card turns
 * over in the middle for a moment.
 */
export function Screen({ token, initial, qrSvg }: { token: string; initial: ScreenView; qrSvg: string }) {
  const [view, setView] = useState(initial);
  const [offset] = useState(() => initial.now - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const seenReveal = useRef(initial.reveal?.at ?? 0);
  const [reveal, setReveal] = useState<ScreenView["reveal"]>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await screenAction(token);
        if (next) setView(next);
      } catch {
        // The next round will do.
      }
    }, 2000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [token]);

  // A card the meneur reveals turns over here for a moment; « Retirer » takes it away at once.
  useEffect(() => {
    if (!view.reveal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the server's reveal
      setReveal(null);
      return;
    }
    if (view.reveal.at <= seenReveal.current) return;
    seenReveal.current = view.reveal.at;
    setReveal(view.reveal);
    const t = setTimeout(() => setReveal(null), 14_000);
    return () => clearTimeout(t);
  }, [view.reveal]);

  const started = view.startedAt !== null && view.status !== "setup";
  const elapsed = started ? (view.endedAt ?? now + offset) - view.startedAt! : 0;
  const alive = view.seats.filter((s) => s.alive);
  const dead = view.seats.filter((s) => !s.alive).sort((a, b) => (a.deathOrder ?? 99) - (b.deathOrder ?? 99));
  const night = view.status === "playing" && view.night;
  const cols = view.seats.length > 14 ? 3 : 2;
  const kicker =
    view.status === "setup" ? "La partie se prépare" : view.status === "dealing" ? "Les cartes sont distribuées" : view.status === "done" ? "Partie terminée" : night ? "Fermez les yeux" : "Le village se réveille";

  return (
    <div className={`lg-screen ${night ? "is-night" : ""}`} onDoubleClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>
      <div className="lg-screen-paper flex flex-col px-[4cqw] pt-[3cqw] pb-[2.5cqw]">
        <div className="lg-screen-moon" />
        <div className="lg-screen-stain" />

        <header className="flex items-end justify-between gap-[2cqw] pl-[12cqw]">
          <div>
            <p className="lg-screen-caps text-[1.5cqw] text-[var(--w-rust)]">{kicker}</p>
            <h1 className="lg-screen-title text-[6.4cqw]">Loups-garous</h1>
          </div>
          <div className="text-right">
            {view.status === "playing" && <p className="lg-screen-title text-[3.6cqw]">{phaseLabel(view.turn)}</p>}
            {started && <p className="lg-screen-caps text-[2.2cqw] tabular-nums">{clock(elapsed)}</p>}
          </div>
        </header>

        <div className="mt-[2cqw] grid min-h-0 flex-1 grid-cols-[1.7fr_1fr] gap-[3cqw]">
          <section className="min-h-0">
            <p className="lg-screen-caps text-[1.3cqw] text-[var(--w-muted)]">
              {alive.length} en vie{dead.length ? ` · ${dead.length} ${dead.length > 1 ? "morts" : "mort"}` : ""}
            </p>
            <ul className={`mt-[0.8cqw] grid gap-x-[2cqw] ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {[...alive, ...dead].map((s) => (
                <li key={s.id} className={`lg-screen-seat flex items-center gap-[1cqw] py-[0.55cqw] ${s.alive ? "" : "is-dead"}`}>
                  {!s.alive && s.role ? (
                    <CardFace role={s.role} art={view.art} className="w-[2.6cqw] shrink-0 text-[0.32cqw]" />
                  ) : (
                    <span className="w-[2.6cqw] shrink-0 text-center text-[1.6cqw]">{s.alive ? "" : "✝"}</span>
                  )}
                  <span className="min-w-0">
                    <span className="lg-screen-seat-name block truncate text-[2.3cqw] font-semibold">{s.name}</span>
                    {!s.alive && s.roleName && <span className="lg-screen-caps block text-[1cqw] text-[var(--w-rust)]">{s.roleName}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <aside className="flex min-h-0 flex-col justify-between">
            <div>
              <p className="lg-screen-caps text-[1.3cqw] text-[var(--w-muted)]">Encore en jeu</p>
              <ul className="mt-[0.8cqw] flex flex-col gap-[0.35cqw]">
                {view.cardsLeft.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-[1cqw] text-[1.7cqw]">
                    <span>{c.name}</span>
                    <span className="lg-screen-caps text-[var(--w-rust)] tabular-nums">× {c.count}</span>
                  </li>
                ))}
              </ul>
              {view.spare > 0 && <p className="mt-[0.6cqw] text-[1.1cqw] text-[var(--w-muted)]">dont {view.spare === 1 ? "une carte restée" : `${view.spare} cartes restées`} face cachée</p>}
            </div>
            {view.dealMode === "app" && view.status !== "done" && (
              <div className="flex items-end justify-end gap-[1cqw]">
                <p className="lg-screen-caps text-right text-[1.1cqw]">
                  Ta carte
                  <br />
                  sur ton téléphone
                </p>
                <div className="w-[10cqw] rounded-[0.5cqw] bg-white p-[0.5cqw]" aria-label="QR code de la partie" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              </div>
            )}
          </aside>
        </div>
      </div>

      {view.status === "done" && view.winner && !reveal && (
        <div className="lg-screen-veil">
          <p className="lg-screen-caps text-[2cqw] text-[#d0552d]">{started ? `Partie terminée · ${clock(elapsed)}` : "Partie terminée"}</p>
          <p className="lg-screen-title lg-rise text-center text-[7cqw] leading-none">{WINNER_LABELS[view.winner]}</p>
        </div>
      )}
      {reveal && <Reveal key={reveal.at} name={reveal.name} role={reveal.role} art={view.art} big />}
    </div>
  );
}
