"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { alive, momentOf, type Action } from "@/modules/loups/scenarios/engine";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import { PROPS, SPACES } from "@/modules/loups/scenarios/station";
import type { PublicScenario } from "@/modules/loups/scenarios/types";
import type { Act } from "./controls";
import { CutSounds, EffectRows, IntrusionBlock, LightRows, ScreenChoices, SoundRows } from "./Station";

/**
 * Two ways to hold the console, for two people running the evening together (Arthur tells the story,
 * Rémi plays the base): « Narration » (the game, its texts, its players: the console as it was) and
 * « Environnement » (everything that sounds and shines in the station, whatever the story; nothing in it
 * moves the game on). Each device chooses, and remembers; a tablet held sideways gets its wide layout in
 * either mode.
 */

export type ConsoleMode = "narration" | "environnement";

const MODE_KEY = "clhub-scenario-console-mode";
const MODE_EVENT = "clhub-scenario-console-mode";
const WIDE = "(orientation: landscape) and (min-width: 1024px)";

function storedMode(): ConsoleMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "narration" || v === "environnement" ? v : null;
  } catch {
    return null;
  }
}

const onMode = (cb: () => void) => {
  window.addEventListener(MODE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(MODE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

const onWide = (cb: () => void) => {
  const q = window.matchMedia(WIDE);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

/** A tablet (or a computer) held in landscape. */
export function useWide(): boolean {
  return useSyncExternalStore(
    onWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

/**
 * The mode this device last chose. Before any choice: a co-organizer on a tablet in landscape starts on
 * the environment (that is what the tablet is for); everyone else starts on the narration.
 */
export function useConsoleMode(role: ConsoleView["role"]): [ConsoleMode, (m: ConsoleMode) => void] {
  const wide = useWide();
  const stored = useSyncExternalStore(onMode, storedMode, () => null);
  // When the browser refuses storage (a private window), the choice still holds for this page.
  const [local, setLocal] = useState<ConsoleMode | null>(null);
  const choose = (m: ConsoleMode) => {
    setLocal(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // Kept in `local`.
    }
    window.dispatchEvent(new Event(MODE_EVENT));
  };
  return [local ?? stored ?? (wide && role === "cohost" ? "environnement" : "narration"), choose];
}

/** One small button to the other mode: the console's head stays a single line. */
export function ModeSwitch({ mode, onChange }: { mode: ConsoleMode; onChange: (m: ConsoleMode) => void }) {
  const other = mode === "narration" ? "environnement" : "narration";
  return (
    <button type="button" onClick={() => onChange(other)} aria-label={other === "environnement" ? "Passer en mode environnement" : "Passer en mode narration"} className="min-h-8 shrink-0 rounded-[10px] border border-[#1f3a4b] px-2.5 text-[0.66rem] font-bold tracking-[0.08em] text-[#6f8796]">
      {other === "environnement" ? "ENVIRONNEMENT ›" : "NARRATION ›"}
    </button>
  );
}

const panel = "flex flex-col gap-3 rounded-xl border border-[#1f3a4b] bg-[#0c141b] p-3";

/**
 * The environment: what the room hears and sees, switched on and off at will. During the game every
 * gesture here is décor: it changes the room, never the story. On a tablet in landscape, three columns:
 * where the game is, the sounds, the light and the effects.
 */
export function EnvironmentFace({ def, view, busy, act }: { def: PublicScenario; view: ConsoleView; busy: boolean; act: Act }) {
  return (
    <div className="grid gap-3 lg:landscape:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] lg:landscape:items-start">
      <div className="flex flex-col gap-3">
        <FollowPanel def={def} view={view} />
        <section aria-label="À l'écran" className={panel}>
          <OnScreen def={def} view={view} busy={busy} act={act} scope="environment" />
        </section>
        <section aria-label="Écran de la salle" className={panel}>
          <ScreenChoices view={view} busy={busy} act={act} />
        </section>
      </div>
      <section aria-label="Les sons" className={panel}>
        <SoundRows def={def} view={view} busy={busy} act={act} />
        <CutSounds busy={busy} act={act} />
      </section>
      <section aria-label="Lumière et effets" className={panel}>
        <LightRows view={view} busy={busy} act={act} />
        <EffectRows view={view} busy={busy} act={act} />
        <IntrusionBlock view={view} busy={busy} act={act} />
      </section>
    </div>
  );
}

/** Where the game is, for the one who plays the base without the texts: the moment, the living, the length, the event. */
export function FollowPanel({ def, view }: { def: PublicScenario; view: ConsoleView }) {
  const s = view.state;
  const now = useMinuteClock(view.now);
  const event = s.event ? view.setup.events.find((e) => e.id === s.event) : null;
  const where = SPACES.find((sp) => sp.id === s.at);
  const title = view.status === "done" ? "Partie terminée" : view.status === "setup" ? (s.loadingAt !== null ? `${def.short ?? def.title} chargé` : "La station seule") : momentOf(s);
  return (
    <section aria-label="Où en est la partie" className={`${panel} border-[#5a4316]`}>
      <p className="text-[0.66rem] font-bold tracking-[0.16em] text-[var(--scn-amber)]">OÙ EN EST LA PARTIE</p>
      <p className="scn-vt text-4xl leading-none text-[var(--scn-txt)]">{title.toUpperCase()}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {view.status === "setup" ? (
          <Fact label="Sujets inscrits">{view.setup.players.length}</Fact>
        ) : (
          <Fact label="Sujets en vie">
            {alive(s).length} / {s.players.length}
          </Fact>
        )}
        <Fact label="Durée">{view.startedAt ? elapsed(view.startedAt, now) : "pas commencée"}</Fact>
        <Fact label="Événement du jour" wide>
          {s.phase === "day" && event ? event.name : "aucun"}
        </Fact>
        {where && (
          <Fact label="Le groupe est" wide>
            {where.name}
          </Fact>
        )}
        {s.timer && (
          <Fact label="Minuteur" wide>
            {s.timer.label ?? "en cours"}
            {s.timer.endsAt === null ? " · en pause" : ""}
          </Fact>
        )}
      </dl>
    </section>
  );
}

function Fact({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[0.66rem] font-bold tracking-[0.12em] text-[var(--scn-muted)]">{label.toUpperCase()}</dt>
      <dd className="font-semibold text-[var(--scn-txt)] tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * What plays and shows in the room right now, each with its own way off: the one place where anything
 * left on is found and switched off, whatever opened it (a sheet, the guide, a fault). On the environment
 * console, what belongs to the story (a terminal, a fault, the timers) is shown but left to the narration.
 */
export function OnScreen({ def, view, busy, act, scope = "all", compact = false }: { def: PublicScenario; view: ConsoleView; busy: boolean; act: Act; scope?: "all" | "environment"; compact?: boolean }) {
  const s = view.state;
  const term = def.terminals.find((t) => t.id === s.terminal);
  const file = term?.files.find((f) => f.id === s.playing);
  const faults = [...def.faults, ...view.setup.extraFaults];
  const items: { label: string; off: Action; story?: boolean }[] = [
    ...(term ? [{ label: `Terminal : ${term.label.replace(/^Terminal (de l'|du |des |de la )?/i, "")}${file ? ` · ${view.setup.files?.[file.id]?.name || file.name}` : ""}`, off: { t: "terminal", id: null } as Action, story: true }] : []),
    ...(s.circuitShown ? [{ label: "Boîtier de la panic room", off: { t: "circuit", show: false } as Action, story: true }] : []),
    ...(s.prop ? [{ label: PROPS.find((p) => p.id === s.prop)?.name ?? "Un meuble", off: { t: "prop", id: null } as Action, story: true }] : []),
    ...s.faultsOn.map((id) => ({ label: `Faille : ${faults.find((f) => f.id === id)?.title ?? id}`, off: { t: "fault", id, on: false } as Action, story: true })),
    ...s.ambiances.map((id) => ({ label: `♪ ${def.media.find((m) => m.id === id)?.label ?? id}`, off: { t: "stopSound", slot: id } as Action })),
    ...(s.light ? [{ label: "Hall allumé", off: { t: "light", on: false } as Action }] : []),
    ...(s.dark ? [{ label: "Délestage", off: { t: "dark", on: false } as Action }] : []),
    ...(s.blizzard ? [{ label: "Blizzard", off: { t: "blizzard", on: false } as Action }] : []),
    ...(s.aurora ? [{ label: "Aurore", off: { t: "aurora", on: false } as Action }] : []),
    ...(s.intrusion ? [{ label: "Intrusion", off: { t: "intrusion", text: null } as Action }] : []),
    ...(s.drawing ? [{ label: "Dessin", off: { t: "drawing", strokes: null } as Action }] : []),
    ...(s.gauge ? [{ label: "Jauge des générateurs", off: { t: "gauge", seconds: null } as Action, story: true }] : []),
    ...(s.timer ? [{ label: `Minuteur${s.timer.label ? ` : ${s.timer.label}` : ""}`, off: { t: "timer", which: "main", cmd: "stop" } as Action, story: true }] : []),
    ...(s.neutral ? [{ label: s.neutral === "black" ? "Écran : en attente" : "Écran : plan seul", off: { t: "neutral", mode: null } as Action }] : []),
  ];
  if (compact && items.length === 0) return null;
  return (
    <div aria-label={compact ? "À l'écran" : undefined} className="flex flex-wrap items-center gap-1.5">
      <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[#bfeaff]">À L&apos;ÉCRAN</span>
      {items.length ? (
        items.map((x) =>
          scope === "environment" && x.story ? (
            <span key={x.label} className="scn-chip opacity-70">
              {x.label}
            </span>
          ) : (
            <button key={x.label} type="button" aria-label={`Retirer : ${x.label}`} disabled={busy} onClick={() => void act(x.off)} className="scn-chip flex min-h-8 items-center gap-1.5">
              {x.label}
              <span aria-hidden className="text-[var(--scn-bad)]">
                ×
              </span>
            </button>
          ),
        )
      ) : (
        <span className="text-xs text-[var(--scn-muted)]">rien d&apos;allumé</span>
      )}
    </div>
  );
}

/** The time, a minute at a time (the game's length needs no seconds). */
function useMinuteClock(serverNow: number): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(now, serverNow);
}

function elapsed(from: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - from) / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}
