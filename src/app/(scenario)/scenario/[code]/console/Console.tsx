"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { actionAvailable, alive, contagionActive, dawnDeaths, doorProposals, flagName, momentOf, nightSteps, pack, proposals, secretFoundToday, type Action, type NightStepId, type VoteKind } from "@/modules/loups/scenarios/engine";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import type { PublicScenario } from "@/modules/loups/scenarios/types";
import { consoleAction, deleteEveningAction, replayEveningAction } from "../../actions";
import { Prep } from "./Prep";
import { FaultHint, Reader } from "./Reader";

export type Send = (input: Record<string, unknown>) => Promise<string | null>;
type Act = (action: Action) => Promise<string | null>;

/** The meneur's phone: what to do next first, then the base, the faults, the sounds, the journal. */
export function Console({
  code,
  def,
  initialView,
  members,
  qrSvg,
}: {
  code: string;
  def: PublicScenario;
  initialView: ConsoleView;
  members: { id: string; name: string }[];
  qrSvg: string;
}) {
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The text being read: the console stays mounted underneath, exactly where it was.
  const [reading, setReading] = useState<{ start?: string; variant?: string | null } | null>(null);
  const moves = useRef(0);

  const send: Send = async (input) => {
    moves.current += 1;
    setBusy(true);
    setError("");
    try {
      const result = await consoleAction(code, input);
      if (!result.ok) {
        setError(result.error);
        return result.error;
      }
      setView(result.view);
      return null;
    } catch {
      setError("Pas de connexion : le geste n'est pas passé, réessaie.");
      return "offline";
    } finally {
      moves.current += 1;
      setBusy(false);
    }
  };
  const act: Act = (action) => send({ type: "act", action });

  // The projection's heartbeat and the co-organizer's gestures show up by themselves.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const before = moves.current;
      try {
        const result = await consoleAction(code, { type: "refresh" });
        if (result.ok && moves.current === before) setView(result.view);
      } catch {
        // The next round will do.
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [code]);

  const s = view.state;
  const p = view.projection;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 px-3 pt-4 pb-36">
      <header className="flex flex-col gap-1 border-b border-[var(--scn-line)] pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="scn-vt text-2xl tracking-wider text-[var(--scn-ice)]">CONSOLE · {def.title.toUpperCase()}</h1>
          {view.status === "live" && (
            <button type="button" className="scn-btn min-h-10 px-3 text-xs" disabled={busy || !view.canUndo} onClick={() => void send({ type: "undo" })}>
              ↶ Annuler
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[var(--scn-muted)]">{view.status === "setup" ? "Préparation" : momentOf(s)}</span>
          <span className={`scn-chip ${p.connected ? "scn-chip-ok" : "scn-chip-bad"}`}>{p.connected ? "Projection connectée" : "Projection déconnectée"}</span>
          <span className={`scn-chip ${p.mediaTotal > 0 && p.mediaReady === p.mediaTotal ? "scn-chip-ok" : "scn-chip-warn"}`}>
            Médias {p.mediaReady} / {p.mediaTotal || def.media.length}
          </span>
          <span className={`scn-chip ${p.mic ? "scn-chip-ok" : ""}`}>{p.mic ? "Micro prêt" : "Pas de micro"}</span>
        </div>
        {view.simulated && <p className="scn-vt rounded-lg border border-[var(--scn-magenta)] py-1 text-center text-xl tracking-[0.3em] text-[var(--scn-magenta)]">SIMULATION</p>}
        {view.status === "live" && !view.simulated && <p className="text-[0.68rem] text-[var(--scn-amber)]">Soirée en cours : aucune mise à jour du CLHUB d&apos;ici la fin.</p>}
      </header>
      {error && (
        <p role="alert" className="rounded-xl border border-[var(--scn-bad)] p-3 text-sm text-[var(--scn-bad)]">
          {error}
        </p>
      )}

      {view.status === "setup" && <Prep code={code} def={def} view={view} members={members} qrSvg={qrSvg} busy={busy} send={send} />}
      {view.status === "live" && (
        <>
          <PhaseSection def={def} view={view} busy={busy} act={act} send={send} />
          <Powers def={def} view={view} busy={busy} act={act} />
          <Chief def={def} view={view} busy={busy} act={act} />
          <Players def={def} view={view} busy={busy} act={act} />
          <Base def={def} view={view} busy={busy} act={act} />
          <Terminals def={def} view={view} busy={busy} act={act} />
          <Circuit view={view} busy={busy} act={act} />
          <Faults def={def} view={view} busy={busy} act={act} />
          <Sounds def={def} view={view} busy={busy} act={act} />
          <Effects def={def} view={view} busy={busy} act={act} />
          <Journal view={view} send={send} />
          <ProjectionLink view={view} qrSvg={qrSvg} code={code} />
          {view.role === "host" && <DeleteEvening code={code} live />}
        </>
      )}
      {view.status === "done" && <Done code={code} view={view} />}
      {view.status === "live" && reading && <Reader def={def} view={view} start={reading.start} variant={reading.variant} onClose={() => setReading(null)} />}
      {view.status === "live" && !reading && <FaultHint view={view} onRead={(variant) => setReading({ start: "FAILLE-01", variant })} />}
      {view.status === "live" && <CommandBar view={view} busy={busy} act={act} send={send} reading={!!reading} onText={() => setReading(reading ? null : {})} />}
    </div>
  );
}

/**
 * Always there, one gesture away, above everything (no dialog ever covers it): Stop, the neutral
 * screen, Annuler. The meneur is never stuck.
 */
function CommandBar({ view, busy, act, send, reading, onText }: { view: ConsoleView; busy: boolean; act: Act; send: Send; reading: boolean; onText: () => void }) {
  const s = view.state;
  return (
    <nav aria-label="Commandes" className="fixed inset-x-0 bottom-0 z-[70] border-t border-[var(--scn-line)] bg-[rgba(12,18,24,.97)] px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1.5">
        <button type="button" className="scn-btn scn-btn-danger min-h-12 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "stop" })}>
          ■ Stop<small>tout ce qui joue</small>
        </button>
        <button type="button" className={`scn-btn min-h-12 px-1 text-xs ${s.neutral === "plan" ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "neutral", mode: s.neutral === "plan" ? null : "plan" })}>
          Écran neutre<small>{s.neutral === "plan" ? "revenir" : "le plan"}</small>
        </button>
        <button type="button" className={`scn-btn min-h-12 px-1 text-xs ${s.neutral === "black" ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "neutral", mode: s.neutral === "black" ? null : "black" })}>
          Écran noir<small>{s.neutral === "black" ? "revenir" : "secours"}</small>
        </button>
        <button type="button" className="scn-btn min-h-12 px-1 text-xs" disabled={busy || !view.canUndo} onClick={() => void send({ type: "undo" })}>
          ↶ Annuler<small>dernière action</small>
        </button>
        <button type="button" className={`scn-btn min-h-12 px-1 text-xs ${reading ? "scn-btn-on" : "scn-btn-amber"}`} onClick={onText}>
          Texte<small>{reading ? "masquer" : "à lire"}</small>
        </button>
      </div>
    </nav>
  );
}

/** Play, pause, back to the start, ±10 s: for the tape on the terminal, or the last sound played. */
function MediaControls({ busy, act }: { busy: boolean; act: Act }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {(
        [
          ["restart", "⏮", "Au début"],
          ["back", "−10 s", "Reculer de 10 s"],
          ["pause", "⏸", "Pause"],
          ["play", "▶", "Lecture"],
          ["forward", "+10 s", "Avancer de 10 s"],
        ] as const
      ).map(([cmd, label, aria]) => (
        <button key={cmd} type="button" aria-label={aria} className="scn-btn min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "media", cmd })}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** A timer's controls: pause or resume, one minute more or less, stop. */
function TimerControls({ which, timer, busy, act }: { which: "gauge" | "main"; timer: { endsAt: number | null } | null; busy: boolean; act: Act }) {
  if (!timer) return null;
  return (
    <div className="grid grid-cols-4 gap-1">
      <button type="button" className="scn-btn min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which, cmd: timer.endsAt === null ? "resume" : "pause" })}>
        {timer.endsAt === null ? "▶ Reprendre" : "⏸ Pause"}
      </button>
      <button type="button" className="scn-btn min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which, cmd: "minus" })}>
        −1 min
      </button>
      <button type="button" className="scn-btn min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which, cmd: "plus" })}>
        +1 min
      </button>
      <button type="button" className="scn-btn scn-btn-danger min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which, cmd: "stop" })}>
        ■ Arrêter
      </button>
    </div>
  );
}

export function Section({ title, chip, open = false, children }: { title: string; chip?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="scn-sec p-3" open={open}>
      <summary className="scn-head flex cursor-pointer items-center justify-between gap-2 py-1">
        <span>{title}</span>
        {chip}
      </summary>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </details>
  );
}

const Row = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-2">{children}</div>;

function PlayerSelect({ players, value, onChange, label, none }: { players: { id: string; name: string; room: number }[]; value: string; onChange: (v: string) => void; label: string; none: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="scn-field w-full">
      <option value="">{none}</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · ch. {p.room}
        </option>
      ))}
    </select>
  );
}

type Props = { def: PublicScenario; view: ConsoleView; busy: boolean; act: Act };

const nameIn = (s: ConsoleView["state"], id: string | null | undefined) => s.players.find((x) => x.id === id)?.name ?? "personne";
/** The items the meneur hands out: the syringes go as one. */
const HANDED = (def: PublicScenario) => [...def.items.filter((i) => i.family !== "room" && i.effect !== "life" && i.effect !== "death").map((i) => ({ id: i.id, name: i.name, secret: i.family === "secret" })), { id: "seringues", name: "Seringues (vie et mort)", secret: true }];
const holderOf = (s: ConsoleView["state"], item: string) => s.items[item === "seringues" ? "vie" : item]?.holder ?? null;

// ───────── Phase: where we are, what comes next ─────────

function PhaseSection({ def, view, busy, act, send }: Props & { send: Send }) {
  const s = view.state;
  const [choice, setChoice] = useState("");
  const [confirmGood, setConfirmGood] = useState(false);
  const [confirmBad, setConfirmBad] = useState(false);
  const living = alive(s);
  const pick = (fn: (id: string) => Promise<unknown>) => async () => {
    if (!choice) return;
    await fn(choice);
    setChoice("");
  };
  return (
    <Section title="PHASE" chip={<span className="scn-chip scn-chip-warn">{momentOf(s)}</span>} open>
      {s.phase === "welcome" && (
        <>
          <p className="text-sm text-[var(--scn-muted)]">L&apos;écran d&apos;accueil est affiché. Quand tout le monde est installé :</p>
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "start" })}>
            Commencer : prologue du bus
          </button>
        </>
      )}
      {s.phase === "bus" && (
        <>
          <p className="text-sm text-[var(--scn-muted)]">
            {s.loop === 1 ? "Lis ton texte. Lance le moteur du bus dans Sons." : `Boucle ${s.loop} : retour dans le bus.`}
          </p>
          {s.loop === 1 && (
            <button type="button" className="scn-btn" disabled={busy || !view.projection.mic} onClick={() => void act({ t: "record" })}>
              🎙️ Enregistrer 30 s<small>{view.projection.mic ? "par le micro de l'ordinateur de projection" : "micro non autorisé sur la projection"}</small>
            </button>
          )}
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "arrive" })}>
            Arriver à la base
          </button>
        </>
      )}
      {s.phase === "arrival" && (
        <>
          <Checklist
            items={[
              { done: s.light, label: "Allumer le hall", action: () => act({ t: "light", on: true }) },
              { done: !!s.doors.dortoir, label: "Ouvrir le dortoir (Δ)", action: () => act({ t: "door", door: "dortoir", open: true }) },
            ]}
            busy={busy}
          />
          {s.loop >= 2 && s.chiefToConfirm && s.chiefB1 ? (
            <div className="rounded-xl border border-[var(--scn-ice-dim)] p-3 text-sm">
              <p>
                Le terminal du hall demande : chef de mission <b>{nameIn(s, s.chiefB1)}</b>, confirmer ?
              </p>
              <Row>
                <button type="button" className="scn-btn scn-btn-on" disabled={busy} onClick={() => void act({ t: "chiefConfirm" })}>
                  Confirmer
                </button>
                <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "chief", player: null })}>
                  Relancer l&apos;élection
                </button>
              </Row>
            </div>
          ) : !s.chief ? (
            <VoteControl
              def={def}
              view={view}
              busy={busy}
              act={act}
              kind="chief"
              title="Élection du chef de mission"
              hint="Coche les volontaires : ils deviennent les portes de la projection."
              choices={living.map((p) => ({ id: p.id, label: `${p.name} · ch. ${p.room}` }))}
              initial={[]}
            />
          ) : (
            <p className="text-xs text-[var(--scn-ok)]">Chef de mission : {nameIn(s, s.chief)}</p>
          )}
          {s.loop >= 2 && <Reassign def={def} view={view} busy={busy} act={act} />}
          <p className="text-sm text-[var(--scn-muted)]">Distribue les cartes, puis note le patient zéro.</p>
          <PlayerSelect players={living} value={choice || s.patientZero || ""} onChange={setChoice} label="Patient zéro" none="Patient zéro…" />
          <Row>
            <button type="button" className="scn-btn" disabled={busy || !choice} onClick={pick((id) => act({ t: "patientZero", player: id }))}>
              Noter le patient zéro
            </button>
            <button type="button" className="scn-btn scn-btn-primary" disabled={busy || !s.patientZero} onClick={() => void act({ t: "night" })}>
              🌙 La nuit tombe
            </button>
          </Row>
          {s.patientZero && <p className="text-xs text-[var(--scn-ok)]">Patient zéro : {nameIn(s, s.patientZero)}</p>}
        </>
      )}
      {s.phase === "night" && <NightWizard def={def} view={view} busy={busy} act={act} />}
      {s.phase === "day" && <DayPlan def={def} view={view} busy={busy} act={act} onGood={() => setConfirmGood(true)} />}
      {s.phase === "loopEnd" && (
        <>
          <p className="text-sm">Boucle {s.loop} terminée : victoire {s.winner === "village" ? "du village" : "de la meute"}.</p>
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => (s.loop < view.setup.params.loops ? void act({ t: "reboot" }) : setConfirmBad(true))}>
            {s.loop < view.setup.params.loops ? `⟳ Reboot : boucle ${s.loop + 1}` : "Mauvaise fin"}
            <small>{s.loop < view.setup.params.loops ? "chambres des morts scellées · objets trouvés gardés, porteurs effacés" : "dernière boucle : les indices manqués défilent"}</small>
          </button>
        </>
      )}
      {(s.phase === "good" || s.phase === "bad") && (
        <>
          <p className="text-sm">{s.phase === "good" ? "Bonne fin : lis ton texte." : "Mauvaise fin : les indices manqués défilent à l'écran."}</p>
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void send({ type: "finish" })}>
            Terminer la soirée
          </button>
        </>
      )}
      <Jump busy={busy} act={act} />
      {(s.phase === "night" || s.phase === "arrival" || s.phase === "loopEnd") && (
        <button type="button" className="scn-btn scn-btn-danger mt-1" disabled={busy} onClick={() => setConfirmGood(true)}>
          Le village vote contre le meneur
        </button>
      )}
      {confirmBad && (
        <div role="dialog" aria-modal="true" aria-label="Mauvaise fin" className="scn-veil fixed inset-x-0 top-0 bottom-[4.75rem] z-50 flex items-end justify-center p-3 sm:items-center" onClick={() => setConfirmBad(false)}>
          <div className="scn-sec w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="scn-vt text-2xl text-[var(--scn-bad)]">FIN DE SESSION</p>
            <p className="mt-1 text-sm text-[var(--scn-muted)]">C&apos;était la dernière boucle : la mauvaise fin s&apos;affiche, puis les indices manqués défilent.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="scn-btn scn-btn-danger"
                disabled={busy}
                onClick={async () => {
                  if (!(await act({ t: "reboot" }))) setConfirmBad(false);
                }}
              >
                Déclencher la mauvaise fin
              </button>
              <button type="button" className="scn-btn" onClick={() => setConfirmBad(false)}>
                Revenir
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmGood && (
        <div role="dialog" aria-modal="true" aria-label="Bonne fin" className="scn-veil fixed inset-x-0 top-0 bottom-[4.75rem] z-50 flex items-end justify-center p-3 sm:items-center" onClick={() => setConfirmGood(false)}>
          <div className="scn-sec w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="scn-vt text-2xl text-[var(--scn-ok)]">LE VILLAGE VOTE CONTRE LE MENEUR</p>
            <p className="mt-1 text-sm text-[var(--scn-muted)]">La simulation s&apos;interrompt : c&apos;est la vraie fin.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="scn-btn scn-btn-on"
                disabled={busy}
                onClick={async () => {
                  if (!(await act({ t: "goodEnd" }))) setConfirmGood(false);
                }}
              >
                Déclencher la bonne fin
              </button>
              <button type="button" className="scn-btn" onClick={() => setConfirmGood(false)}>
                Revenir
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/** A short list of what to do, each line done by one gesture. */
function Checklist({ items, busy }: { items: { done: boolean; label: string; action: () => Promise<unknown> }[]; busy: boolean }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li key={it.label}>
          <button type="button" className={`scn-btn w-full text-left ${it.done ? "scn-btn-on" : ""}`} disabled={busy || it.done} onClick={() => void it.action()}>
            {it.done ? "✓ " : "○ "}
            {it.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** « Sauter à »: any phase, out of the expected order, for a meneur who knows better. */
function Jump({ busy, act }: { busy: boolean; act: Act }) {
  const [phase, setPhase] = useState("");
  const PHASES = [
    ["bus", "Le bus"],
    ["arrival", "L'arrivée"],
    ["night", "La nuit"],
    ["day", "Le jour"],
    ["loopEnd", "La fin de boucle (reboot)"],
  ] as const;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer py-2 text-[var(--scn-muted)]">Sauter à une autre phase…</summary>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select aria-label="Phase" value={phase} onChange={(e) => setPhase(e.target.value)} className="scn-field">
          <option value="">Phase…</option>
          {PHASES.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="scn-btn"
          disabled={busy || !phase}
          onClick={async () => {
            if (!(await act({ t: "jump", phase: phase as "bus" | "arrival" | "night" | "day" | "loopEnd" }))) setPhase("");
          }}
        >
          Sauter
        </button>
      </div>
    </details>
  );
}

/**
 * The vote by moving, one component for three uses: the door of the day, the dead's moment, the
 * election. Choose what's proposed, launch the chrono (pause, +30 s), enter the result in one gesture.
 */
function VoteControl({
  view,
  busy,
  act,
  kind,
  title,
  hint,
  choices,
  initial,
}: Props & { kind: VoteKind; title: string; hint: string; choices: { id: string; label: string; sub?: string }[]; initial: string[] }) {
  const s = view.state;
  const [picked, setPicked] = useState<string[]>(initial);
  const running = s.vote?.kind === kind ? s.vote : null;
  const seconds = kind === "door" ? (view.setup.params.voteDoorSeconds ?? 60) : kind === "dead" ? (view.setup.params.voteDeadSeconds ?? 60) : (view.setup.params.voteChiefSeconds ?? 120);
  const labelOf = (id: string) => choices.find((c) => c.id === id)?.label ?? id;
  if (running)
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--scn-amber)] p-3">
        <p className="scn-head text-[var(--scn-amber)]">{title.toUpperCase()} · EN COURS</p>
        {s.timer && (
          <div className="grid grid-cols-2 gap-1">
            <button type="button" className="scn-btn min-h-10 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which: "main", cmd: s.timer?.endsAt === null ? "resume" : "pause" })}>
              {s.timer.endsAt === null ? "▶ Reprendre le chrono" : "⏸ Pause"}
            </button>
            <button type="button" className="scn-btn min-h-10 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which: "main", cmd: "plus", seconds: 30 })}>
              +30 s
            </button>
          </div>
        )}
        <p className="text-xs text-[var(--scn-muted)]">Le résultat, d&apos;un geste :</p>
        {running.options.map((id) => (
          <button key={id} type="button" className="scn-btn scn-btn-primary text-left" disabled={busy} onClick={() => void act({ t: "voteResult", choice: id })}>
            {labelOf(id)}
          </button>
        ))}
        <button type="button" className="scn-btn text-xs" disabled={busy} onClick={() => void act({ t: "voteResult", choice: null })}>
          Annuler le vote
        </button>
      </div>
    );
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--scn-line)] p-3">
      <p className="scn-head">{title.toUpperCase()}</p>
      <p className="text-xs text-[var(--scn-muted)]">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={picked.includes(c.id)}
            className={`scn-btn min-h-10 px-3 text-left text-xs ${picked.includes(c.id) ? "scn-btn-on" : ""}`}
            onClick={() => setPicked(picked.includes(c.id) ? picked.filter((x) => x !== c.id) : [...picked, c.id])}
          >
            {c.label}
            {c.sub && <small>{c.sub}</small>}
          </button>
        ))}
      </div>
      <button type="button" className="scn-btn scn-btn-primary" disabled={busy || picked.length === 0} onClick={() => void act({ t: "vote", kind, options: picked })}>
        Lancer le vote · {seconds} s<small>{picked.map(labelOf).join(" / ") || "rien de coché"}</small>
      </button>
      {picked.length === 1 && (
        <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "voteResult", choice: picked[0]! })}>
          Sans vote : {labelOf(picked[0]!)}
        </button>
      )}
    </div>
  );
}

/** The meneur names who carries an item (« le dé » is staging: nothing is drawn). */
function GiveRow({ item, view, busy, act }: { item: { id: string; name: string }; view: ConsoleView; busy: boolean; act: Act }) {
  const [to, setTo] = useState("");
  return (
    <Row>
      <PlayerSelect players={alive(view.state)} value={to} onChange={setTo} label={`Porteur : ${item.name}`} none={`${item.name}…`} />
      <button type="button" className="scn-btn" disabled={busy || !to} onClick={() => void act({ t: "giveItem", item: item.id, player: to })}>
        Confier
      </button>
    </Row>
  );
}

/** Loop 2: what was found in loop 1 stays found; the meneur hands each item out again, one by one. */
function Reassign({ def, view, busy, act }: Props) {
  const s = view.state;
  const list = HANDED(def).filter((i) => s.found.includes(i.id) && !holderOf(s, i.id));
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--scn-line)] p-3">
      <p className="scn-head">OBJETS À REDISTRIBUER</p>
      {list.map((i) => (
        <GiveRow key={i.id} item={i} view={view} busy={busy} act={act} />
      ))}
    </div>
  );
}

/** The day, in its order: the dead, the event, the door, the room and its items, the debate, the exile. */
function DayPlan({ def, view, busy, act, onGood }: Props & { onGood: () => void }) {
  const s = view.state;
  const [choice, setChoice] = useState("");
  const living = alive(s);
  const doors = doorProposals(def, s);
  const final = s.loop >= 2 && s.round >= 4;
  const labelOf = (id: string) => (id === "fouiller" ? "Fouiller ce qu'on connaît déjà" : (def.dayActions.find((a) => a.id === id)?.label ?? id));
  const available = [...def.dayActions.filter((a) => actionAvailable(def, s, a.id)).map((a) => a.id), "fouiller"];
  const found = s.foundToday.length ? HANDED(def).filter((i) => s.foundToday.includes(i.id)) : [];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        1. Au réveil : {s.announced.length ? <b className="text-[var(--scn-bad)]">{s.announced.map((id) => nameIn(s, id)).join(", ")}</b> : "personne n'est mort"}.
      </p>
      {s.event && <DayEvent def={def} view={view} busy={busy} act={act} />}
      {final ? (
        <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={onGood}>
          3. Le village vote contre le meneur
        </button>
      ) : s.lastAction ? (
        <p className="text-sm text-[var(--scn-ok)]">3. Porte du jour : {labelOf(s.lastAction)}.</p>
      ) : (
        <>
          <VoteControl
            key={doors.join()}
            def={def}
            view={view}
            busy={busy}
            act={act}
            kind="door"
            title="3. Choix de la porte"
            hint="La console propose ces deux portes ; touche pour en changer."
            choices={available.map((id) => ({ id, label: labelOf(id), sub: id === "fouiller" ? "aucun effet de jeu" : def.dayActions.find((a) => a.id === id)?.sentence }))}
            initial={doors}
          />
          {doors.includes("labo") && !s.flags.badge3 && (
            <button type="button" className="scn-btn scn-btn-fault" disabled={busy} onClick={() => void act({ t: "labForce" })}>
              Marga force la porte<small>le village n&apos;a pas le badge de niveau 3 : le laboratoire s&apos;ouvre quand même, avec une faille</small>
            </button>
          )}
        </>
      )}
      {found.length > 0 && (
        <div className="rounded-xl border border-[var(--scn-line)] p-3 text-sm">
          <p className="scn-head">4. OBJETS TROUVÉS</p>
          {found.map((i) => (
            <div key={i.id} className="flex flex-col gap-1">
              <p className="text-xs">
                {i.name} : {holderOf(s, i.id) ? <b>{nameIn(s, holderOf(s, i.id))}</b> : <span className="text-[var(--scn-amber)]">porteur à choisir</span>}
                {i.secret ? " · remis cette nuit, en secret" : " · remis devant tous"}
              </p>
              {!holderOf(s, i.id) && <GiveRow item={i} view={view} busy={busy} act={act} />}
            </div>
          ))}
        </div>
      )}
      <button type="button" className="scn-btn" disabled={busy || !!s.timer} onClick={() => void act({ t: "timer", which: "main", cmd: "start", seconds: 300, label: "Débat" })}>
        5. Débat · 5 min
      </button>
      <p className="text-xs text-[var(--scn-muted)]">6. L&apos;exil.{s.chief ? ` La voix de ${nameIn(s, s.chief)} (chef) compte double.` : ""}</p>
      <PlayerSelect players={living} value={choice} onChange={setChoice} label="Exilé par le vote" none="Le village exile…" />
      <Row>
        <button
          type="button"
          className="scn-btn"
          disabled={busy || !choice}
          onClick={async () => {
            if (!(await act({ t: "exile", player: choice }))) setChoice("");
          }}
        >
          Exiler
        </button>
        <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "exile", player: null })}>
          Personne
        </button>
      </Row>
      {view.suggested && (
        <button type="button" className="scn-btn scn-btn-amber" disabled={busy} onClick={() => void act({ t: "endLoop", winner: view.suggested! })}>
          🏁 Fin de boucle : victoire {view.suggested === "village" ? "du village" : "de la meute"}
          <small>suggéré : {view.suggested === "village" ? "plus aucun contaminé" : "contaminés aussi nombreux que les sains"}</small>
        </button>
      )}
      <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "night" })}>
        🌙 La nuit tombe
      </button>
      <details className="text-xs">
        <summary className="cursor-pointer py-2 text-[var(--scn-muted)]">Terminer la boucle autrement</summary>
        <Row>
          <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "endLoop", winner: "village" })}>
            Victoire du village
          </button>
          <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "endLoop", winner: "meute" })}>
            Victoire de la meute
          </button>
        </Row>
        {!final && (
          <button type="button" className="scn-btn scn-btn-danger mt-2 w-full" disabled={busy} onClick={onGood}>
            Le village vote contre le meneur
          </button>
        )}
      </details>
    </div>
  );
}

function DayEvent({ view, busy, act }: Props) {
  const s = view.state;
  const event = view.setup.events.find((e) => e.id === s.event);
  const [two, setTwo] = useState<[string, string]>(["", ""]);
  if (!event) return null;
  return (
    <div className="rounded-xl border border-[var(--scn-ice-dim)] p-3">
      <p className="text-xs text-[var(--scn-muted)]">2. L&apos;événement choisi par les morts</p>
      <p className="scn-vt text-xl text-[var(--scn-ice)]">{event.name.toUpperCase()}</p>
      <p className="text-sm">{event.rule}</p>
      {event.effect === "gauge" && (
        <button type="button" className="scn-btn mt-2 w-full" disabled={busy} onClick={() => void act({ t: "gauge", seconds: s.gauge ? null : view.setup.params.gaugeSeconds })}>
          {s.gauge ? "Arrêter la jauge" : `Lancer la jauge (${Math.round(view.setup.params.gaugeSeconds / 60)} min)`}
        </button>
      )}
      {event.effect === "quarantine" &&
        (s.quarantine.length ? (
          <p className="mt-2 text-sm text-[var(--scn-ok)]">En quarantaine (protégés cette nuit) : {s.quarantine.map((id) => nameIn(s, id)).join(" et ")}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            <Row>
              <PlayerSelect players={alive(s)} value={two[0]} onChange={(v) => setTwo([v, two[1]])} label="Première personne en quarantaine" none="Première…" />
              <PlayerSelect players={alive(s).filter((p) => p.id !== two[0])} value={two[1]} onChange={(v) => setTwo([two[0], v])} label="Seconde personne en quarantaine" none="Seconde…" />
            </Row>
            <button type="button" className="scn-btn" disabled={busy || !two[0] || !two[1]} onClick={() => void act({ t: "quarantine", players: [two[0], two[1]] })}>
              Mettre en quarantaine
            </button>
          </div>
        ))}
      {event.effect === "dark" && s.dark && (
        <button type="button" className="scn-btn mt-2 w-full" disabled={busy} onClick={() => void act({ t: "dark", on: false })}>
          Lever le délestage<small>la projection revient à l&apos;éclairage normal</small>
        </button>
      )}
      {event.effect === "confinement" && (
        <button type="button" className={`scn-btn mt-2 w-full ${s.confinement ? "scn-btn-on" : "scn-btn-danger"}`} disabled={busy} onClick={() => void act({ t: "confinement", on: !s.confinement })}>
          {s.confinement ? "Porte rouverte" : `Fermer la porte coupe-feu · ${Math.round((view.setup.params.confinementSeconds ?? 360) / 60)} min`}
          <small>{s.confinement ? "fin du confinement" : "alarme, plan coupé en deux, chrono"}</small>
        </button>
      )}
    </div>
  );
}

const STEP_LABELS: Record<NightStepId, string> = {
  pz: "Le patient zéro s'éveille",
  handover: "Remise des objets",
  panic: "Panic room",
  tapes: "Bandes de surveillance",
  infect: "La meute contamine",
  victim: "La meute tue",
  items: "Seringues",
  dead: "Le moment des morts",
};

/** One step at a time, none forgotten: « Passer » moves on. */
function NightWizard({ def, view, busy, act }: Props) {
  const s = view.state;
  const params = view.setup.params;
  const steps = nightSteps(s, params, def);
  const current = steps.find((x) => !s.tonight.done.includes(x)) ?? null;
  const [choice, setChoice] = useState("");
  const living = alive(s);
  const go = async (action: Action) => {
    if (!(await act(action))) setChoice("");
  };
  const name = (id: string | null) => nameIn(s, id);
  const deaths = dawnDeaths(s);
  const pool = view.setup.events.filter((e) => !s.eventsPlayed.includes(e.id));

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-wrap gap-1 text-[0.66rem]">
        {steps.map((step, i) => (
          <li key={step} className={`scn-chip ${s.tonight.done.includes(step) ? "scn-chip-ok" : step === current ? "scn-chip-warn" : ""}`}>
            {i + 1}. {STEP_LABELS[step]}
          </li>
        ))}
      </ol>
      {s.locked && <p className="rounded-lg border border-[var(--scn-bad)] p-2 text-xs text-[var(--scn-bad)]">Verrouillage général : pas de panic room, d&apos;objets ni de pouvoirs jusqu&apos;à la fin de la boucle.</p>}
      {s.tonight.tapes && (
        <p className={`scn-vt rounded-xl border-2 py-2 text-center text-4xl tracking-[0.2em] ${s.tonight.tapes.infected ? "border-[var(--scn-bad)] text-[var(--scn-bad)]" : "border-[var(--scn-ok)] text-[var(--scn-ok)]"}`}>
          {name(s.tonight.tapes.target).toUpperCase()} : {s.tonight.tapes.infected ? "CONTAMINÉ" : "SAIN"}
        </p>
      )}
      <p className="text-xs text-[var(--scn-muted)]">
        Meute : {pack(s).map((x) => x.name).join(", ") || "personne"}
        {contagionActive(s, params) ? "" : " · la contagion est finie"}
        {s.chief && !s.chiefResisted ? ` · le chef ${name(s.chief)} résistera à la première attaque` : ""}
        {s.quarantine.length ? ` · quarantaine : ${s.quarantine.map(name).join(", ")}` : ""}
      </p>
      {current === "pz" && (
        <>
          <p className="text-sm">Le patient zéro ({name(s.patientZero)}) ouvre les yeux.</p>
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void go({ t: "skip", step: "pz" })}>
            Fait
          </button>
        </>
      )}
      {current === "handover" && (
        <>
          <p className="text-sm">Remise des objets secrets trouvés aujourd&apos;hui :</p>
          <ul className="flex flex-col gap-1 text-sm">
            {secretFoundToday(def, s).map((id) => {
              const item = id === "vie" ? "seringues" : id;
              const h = holderOf(s, item);
              return (
                <li key={id} className="rounded-lg border border-[var(--scn-line)] px-2 py-1.5">
                  {h ? (
                    <>
                      Toucher l&apos;épaule de <b>{name(h)}</b> : {HANDED(def).find((x) => x.id === item)?.name}
                    </>
                  ) : (
                    <span className="text-[var(--scn-amber)]">{HANDED(def).find((x) => x.id === item)?.name} : pas encore de porteur (Pouvoirs)</span>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void go({ t: "skip", step: "handover" })}>
            Fait
          </button>
        </>
      )}
      {current === "panic" && (
        <>
          <p className="text-sm">Panic room : {name(s.tonight.panic)} y dort (protégé, et hors de la meute s&apos;il est contaminé).</p>
          <PlayerSelect players={living} value={choice} onChange={setChoice} label="Joueur en panic room" none={`Garder ${name(s.tonight.panic)}`} />
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void go({ t: "panic", player: choice || s.tonight.panic })}>
            L&apos;enfermer pour la nuit
          </button>
        </>
      )}
      {current === "tapes" && (
        <>
          <p className="text-sm">Réveille {name(s.items.bandes?.holder ?? null)} (bandes de surveillance) : qui veut-il regarder ? La console te montre son camp, montre-le d&apos;un geste.</p>
          <PlayerSelect players={living} value={choice} onChange={setChoice} label="Joueur regardé sur les bandes" none="Il regarde…" />
          <Row>
            <button type="button" className="scn-btn scn-btn-primary" disabled={busy || !choice} onClick={() => void go({ t: "tapes", target: choice })}>
              Voir son camp
            </button>
            <button type="button" className="scn-btn" disabled={busy} onClick={() => void go({ t: "tapes", target: null })}>
              Passer
            </button>
          </Row>
        </>
      )}
      {current === "infect" && (
        <>
          <p className="text-sm">La meute contamine une personne.</p>
          <PlayerSelect players={living.filter((x) => !x.infected)} value={choice} onChange={setChoice} label="Personne contaminée" none="Contaminer…" />
          {choice === s.chief && !s.chiefResisted && <p className="text-xs text-[var(--scn-amber)]">C&apos;est le chef : première attaque, elle échoue. Ne touche personne, ne dis rien.</p>}
          <Row>
            <button type="button" className="scn-btn scn-btn-danger" disabled={busy || !choice} onClick={() => void go({ t: "infect", player: choice })}>
              Contaminer
            </button>
            <button type="button" className="scn-btn" disabled={busy} onClick={() => void go({ t: "skip", step: "infect" })}>
              Passer
            </button>
          </Row>
        </>
      )}
      {current === "victim" && (
        <>
          <p className="text-sm">La meute choisit sa victime.{s.tonight.infect ? ` (Contaminé cette nuit : ${name(s.tonight.infect)}.)` : ""}</p>
          <PlayerSelect players={living} value={choice} onChange={setChoice} label="Victime" none="Victime…" />
          <Row>
            <button type="button" className="scn-btn scn-btn-danger" disabled={busy || !choice} onClick={() => void go({ t: "victim", player: choice })}>
              Noter la victime
            </button>
            <button type="button" className="scn-btn" disabled={busy} onClick={() => void go({ t: "skip", step: "victim" })}>
              Passer
            </button>
          </Row>
        </>
      )}
      {current === "items" && <ItemsStep def={def} view={view} busy={busy} act={act} />}
      {current === "dead" &&
        (pool.length ? (
          <VoteControl
            key={proposals(s, view.setup).join()}
            def={def}
            view={view}
            busy={busy}
            act={act}
            kind="dead"
            title="Le moment des morts"
            hint={`Deux événements pas encore joués. ${s.tonight.victim ? `${name(s.tonight.victim)} (victime de cette nuit) ne vote pas.` : ""}`}
            choices={pool.map((e) => ({ id: e.id, label: e.name, sub: e.rule }))}
            initial={proposals(s, view.setup)}
          />
        ) : (
          <p className="text-sm text-[var(--scn-muted)]">Tous les événements ont été joués.</p>
        ))}
      {current === "dead" && (
        <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "skip", step: "dead" })}>
          Passer : pas d&apos;événement
        </button>
      )}
      {current === null && (
        <>
          <p className="text-sm">
            Au réveil : {deaths.length ? <b className="text-[var(--scn-bad)]">{deaths.map(name).join(", ")}</b> : "personne n'est mort"}
            {s.tonight.chosen && <> · événement : {view.setup.events.find((e) => e.id === s.tonight.chosen)?.name}</>}.
          </p>
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "dawn" })}>
            ☀️ Le jour se lève
          </button>
        </>
      )}
    </div>
  );
}

function ItemsStep({ def, view, busy, act }: Props) {
  const s = view.state;
  const [targets, setTargets] = useState<Record<string, string>>({});
  const held = def.items.filter((i) => (i.effect === "life" || i.effect === "death") && !s.items[i.id]?.used && s.items[i.id]?.holder);
  const victim = s.tonight.victim && s.tonight.victim !== s.tonight.panic ? s.players.find((p) => p.id === s.tonight.victim) : null;
  const holderName = (id: string) => nameIn(s, s.items[id]?.holder);
  return (
    <>
      <p className="rounded-xl border border-[var(--scn-line)] p-2 text-sm">
        Réveille {holderName("vie")}. Victime de la nuit : {victim ? <b className="text-[var(--scn-bad)]">{victim.name}</b> : s.tonight.victim ? "aucune (panic room)" : "aucune"}
      </p>
      {held
        .filter((i) => i.effect === "life")
        .map((i) => (
          <button key={i.id} type="button" className="scn-btn scn-btn-on" disabled={busy || !victim} onClick={() => victim && void act({ t: "useItem", item: i.id, target: victim.id })}>
            {i.name} : {victim ? `sauver ${victim.name}` : "personne à sauver"}
            <small>annule la mort, pas la contamination</small>
          </button>
        ))}
      {held
        .filter((i) => i.effect === "death")
        .map((i) => (
          <div key={i.id} className="flex flex-col gap-1.5">
            <p className="text-sm">{i.name} :</p>
            <PlayerSelect players={alive(s)} value={targets[i.id] ?? ""} onChange={(v) => setTargets({ ...targets, [i.id]: v })} label={`Cible de ${i.name}`} none="Cible…" />
            <button type="button" className="scn-btn" disabled={busy || !targets[i.id]} onClick={() => void act({ t: "useItem", item: i.id, target: targets[i.id] ?? null })}>
              Utiliser
            </button>
          </div>
        ))}
      <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "skip", step: "items" })}>
        Fini avec les seringues
      </button>
    </>
  );
}

// ───────── The village's powers ─────────

function Powers({ def, view, busy, act }: Props) {
  const s = view.state;
  const [pick, setPick] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string) => setPick({ ...pick, [k]: v });
  const living = alive(s);
  const day = s.phase === "day";
  const gun = s.items.pistolet;
  return (
    <Section title="POUVOIRS" chip={<span className={`scn-chip ${s.locked ? "scn-chip-bad" : ""}`}>{s.locked ? "VERROUILLÉS" : `${s.found.length} trouvés`}</span>}>
      {s.locked && <p className="rounded-lg border border-[var(--scn-bad)] p-2 text-xs text-[var(--scn-bad)]">Le chef sain a été exilé : objets, panic room, test et radio sont verrouillés jusqu&apos;à la fin de la boucle.</p>}

      <p className="scn-head">PORTEURS</p>
      {HANDED(def).map((i) => {
        const h = holderOf(s, i.id);
        const used = i.id === "seringues" ? !!s.items.vie?.used && !!s.items.mort?.used : !!s.items[i.id]?.used;
        return (
          <div key={i.id} className="flex flex-col gap-1">
            <p className="text-xs">
              <b>{i.name}</b> · {s.found.includes(i.id) ? (h ? nameIn(s, h) : "pas de porteur") : "pas encore trouvé"}
              {used ? " · utilisé" : ""}
              {i.secret ? " · secret" : " · public"}
            </p>
            <Row>
              <PlayerSelect players={living} value={pick[i.id] ?? ""} onChange={set(i.id)} label={`Nouveau porteur : ${i.name}`} none="Personne" />
              <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "giveItem", item: i.id, player: pick[i.id] || null })}>
                {pick[i.id] ? "Confier" : "Retirer"}
              </button>
            </Row>
          </div>
        );
      })}

      <p className="scn-head mt-2">PISTOLET DE DÉTRESSE</p>
      {gun && !gun.used && gun.holder ? (
        <>
          <PlayerSelect players={living.filter((p) => p.id !== gun.holder)} value={pick.shoot ?? ""} onChange={set("shoot")} label="Cible du pistolet" none={`${nameIn(s, gun.holder)} vise…`} />
          <button type="button" className="scn-btn scn-btn-danger" disabled={busy || !day || s.locked || !pick.shoot} onClick={() => void act({ t: "shoot", target: pick.shoot! })}>
            Tir du pistolet<small>{day ? "cible contaminée : elle meurt · saine : la cible et le tireur meurent" : "de jour seulement"}</small>
          </button>
        </>
      ) : (
        <p className="text-xs text-[var(--scn-muted)]">{gun?.used ? "Cartouche tirée pour cette boucle." : "Pas de porteur."}</p>
      )}
      {s.lastShot && (
        <p className="text-xs">
          Dernier tir : {nameIn(s, s.lastShot.shooter)} sur {nameIn(s, s.lastShot.target)} ({s.lastShot.infected ? "contaminé" : "sain : tir sans motif"})
        </p>
      )}
      {s.trusted.length > 0 && <p className="text-xs text-[var(--scn-ok)]">De confiance : {s.trusted.map((id) => nameIn(s, id)).join(", ")}</p>}

      <p className="scn-head mt-2">PANIC ROOM</p>
      {s.panicReady ? (
        <Row>
          <PlayerSelect players={living} value={pick.panic ?? s.panicNext ?? ""} onChange={set("panic")} label="Qui dort en panic room cette nuit" none="Personne cette nuit" />
          <button type="button" className="scn-btn" disabled={busy || s.locked || s.phase !== "day"} onClick={() => void act({ t: "panic", player: pick.panic || null })}>
            Désigner
          </button>
        </Row>
      ) : (
        <p className="text-xs text-[var(--scn-muted)]">Hors service : le circuit est à réparer.</p>
      )}
      {s.panicNext && <p className="text-xs">Cette nuit : {nameIn(s, s.panicNext)}</p>}

      <p className="scn-head mt-2">TEST SANGUIN · UNE FOIS PAR BOUCLE</p>
      {s.found.includes("test") ? (
        s.roomUsed.test ? (
          <p className="text-xs">{s.lastTest ? `${nameIn(s, s.lastTest.target)} : ${s.lastTest.positive ? "POSITIF" : "NÉGATIF"}` : "Utilisé."}</p>
        ) : (
          <Row>
            <PlayerSelect players={living} value={pick.test ?? ""} onChange={set("test")} label="Qui tester" none="Tester…" />
            <button type="button" className="scn-btn" disabled={busy || s.locked || !pick.test} onClick={() => void act({ t: "bloodTest", target: pick.test! })}>
              Tester<small>incubation : contaminé cette nuit, il sort négatif</small>
            </button>
          </Row>
        )
      ) : (
        <p className="text-xs text-[var(--scn-muted)]">À l&apos;infirmerie.</p>
      )}

      <p className="scn-head mt-2">RADIO · UNE FOIS PAR BOUCLE</p>
      {s.found.includes("radio") ? (
        <button type="button" className="scn-btn" disabled={busy || s.locked || s.roomUsed.radio} onClick={() => void act({ t: "radio" })}>
          {s.roomUsed.radio ? `Contaminés en vie : ${s.lastRadio ?? "?"}` : "Utiliser la radio"}
          <small>la projection affiche le nombre de contaminés en vie</small>
        </button>
      ) : (
        <p className="text-xs text-[var(--scn-muted)]">Au PC sécurité.</p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer py-2 text-[var(--scn-muted)]">Accès du village (corriger)…</summary>
        <div className="flex flex-col gap-1">
          {(["key", "badge2", "code", "power", "badge3"] as const).map((f) => (
            <label key={f} className="flex min-h-10 items-center justify-between gap-2">
              <span>{flagName(f)}</span>
              <input type="checkbox" checked={s.flags[f]} disabled={busy} onChange={(e) => void act({ t: "flag", flag: f, on: e.target.checked })} className="h-6 w-6" />
            </label>
          ))}
        </div>
      </details>
    </Section>
  );
}

function Chief({ view, busy, act }: Props) {
  const s = view.state;
  const [next, setNext] = useState("");
  return (
    <Section title="CHEF DE MISSION" chip={<span className={`scn-chip ${s.chief ? "scn-chip-ok" : "scn-chip-warn"}`}>{s.chief ? nameIn(s, s.chief) : "aucun"}</span>}>
      <p className="text-xs text-[var(--scn-muted)]">
        Voix double à l&apos;exil · résiste à la première attaque de la meute dans la boucle{s.chief ? (s.chiefResisted ? " (déjà utilisée)" : " (encore disponible)") : ""} · exilé alors qu&apos;il était sain : verrouillage général.
      </p>
      {s.chiefB1 && s.loop >= 2 && <p className="text-xs">Chef de la boucle 1 : {nameIn(s, s.chiefB1)}</p>}
      <p className="text-xs">{s.chief ? "Successeur ou correction :" : s.formerChief ? `${nameIn(s, s.formerChief)} a transmis son titre à :` : "Nommer le chef :"}</p>
      <Row>
        <PlayerSelect players={alive(s)} value={next} onChange={setNext} label="Chef de mission" none="Choisir…" />
        <button
          type="button"
          className="scn-btn"
          disabled={busy || !next}
          onClick={async () => {
            if (!(await act({ t: "chief", player: next }))) setNext("");
          }}
        >
          Nommer
        </button>
      </Row>
    </Section>
  );
}

// ───────── Players ─────────

function Players({ def, view, busy, act }: Props) {
  const s = view.state;
  return (
    <Section title="JOUEURS" chip={<span className="scn-chip">{alive(s).length} en vie · meute {pack(s).length}</span>}>
      <ul className="flex flex-col gap-1">
        {s.players.map((p) => {
          const items = HANDED(def).filter((i) => holderOf(s, i.id) === p.id);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--scn-line)] px-2 py-1.5 text-sm">
              <span className={`min-w-0 flex-1 ${p.status === "alive" ? "" : "text-[var(--scn-muted)] line-through"}`}>
                {p.name} <span className="text-[0.66rem] text-[var(--scn-muted)]">ch. {p.room}</span>
              </span>
              {s.chief === p.id && <span className="scn-chip scn-chip-ok">chef</span>}
              {p.infected && <span className="scn-chip scn-chip-bad">contaminé · {p.infectedAt}</span>}
              {s.trusted.includes(p.id) && <span className="scn-chip scn-chip-ok">de confiance</span>}
              {(s.tonight.panic === p.id || s.panicNext === p.id) && <span className="scn-chip scn-chip-ok">panic room</span>}
              {s.quarantine.includes(p.id) && <span className="scn-chip">quarantaine</span>}
              {items.map((i) => (
                <span key={i.id} className="scn-chip scn-chip-warn">
                  {i.name}
                </span>
              ))}
              {p.status !== "alive" && <span className="scn-chip">{p.status === "dead" ? "mort" : "exilé"}</span>}
              <span className="flex gap-1">
                <button type="button" className="scn-btn min-h-9 px-2 text-[0.66rem]" disabled={busy} onClick={() => void act(p.status === "alive" ? { t: "kill", player: p.id } : { t: "revive", player: p.id })}>
                  {p.status === "alive" ? "Mort" : "Vivant"}
                </button>
                <button type="button" className="scn-btn min-h-9 px-2 text-[0.66rem]" disabled={busy} onClick={() => void act({ t: "setInfected", player: p.id, infected: !p.infected })}>
                  {p.infected ? "Sain" : "Contaminé"}
                </button>
                <select
                  aria-label={`Chambre de ${p.name}`}
                  value={p.room}
                  disabled={busy}
                  onChange={(e) => void act({ t: "room", player: p.id, room: Number(e.target.value) })}
                  className="scn-field min-h-9 px-1 text-[0.66rem]"
                >
                  {s.players.map((_, i) => (
                    <option key={i} value={i + 1}>
                      ch. {i + 1}
                    </option>
                  ))}
                </select>
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ───────── The base ─────────

function Base({ def, view, busy, act }: Props) {
  const s = view.state;
  const open = def.doors.filter((d) => !d.locked && s.doors[d.id]).length;
  return (
    <Section title="BASE" chip={<span className={`scn-chip ${s.light ? "scn-chip-ok" : "scn-chip-bad"}`}>{s.light ? "HALL ÉCLAIRÉ" : "HALL DANS LE NOIR"}</span>}>
      <Row>
        <button type="button" className={`scn-btn ${s.light ? "" : "scn-btn-primary"}`} disabled={busy} onClick={() => void act({ t: "light", on: !s.light })}>
          {s.light ? "Éteindre le hall" : "Allumer le hall"}
          <small>{s.light ? "retour au noir" : "néons qui démarrent"}</small>
        </button>
        <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "cut" })}>
          Coupure 4 s<small>générateur qui lâche</small>
        </button>
      </Row>
      <p className="scn-head mt-1">
        PORTES · {open} / {def.doors.filter((d) => !d.locked).length} OUVERTES
      </p>
      {def.doors.map((d) => (
        <div key={d.id} className="flex items-center gap-2">
          <span className="flex-1 text-sm">
            <b className="scn-vt mr-1 text-xl text-[var(--scn-ice)]">{d.letter}</b>
            {d.label}
            <small className="block text-[0.66rem] text-[var(--scn-muted)]">{d.hint}</small>
          </span>
          <button
            type="button"
            className={`scn-btn w-28 ${d.locked ? "scn-btn-danger" : s.doors[d.id] ? "scn-btn-on" : ""}`}
            disabled={busy}
            onClick={() => void act({ t: "door", door: d.id, open: d.locked ? false : !s.doors[d.id] })}
          >
            {d.locked ? "Tenter" : s.doors[d.id] ? "Fermer" : "Ouvrir"}
          </button>
          {d.locked && (
            <button type="button" className="scn-btn w-20 px-1 text-[0.66rem]" disabled={busy} onClick={() => void act({ t: "door", door: d.id, open: !s.doors[d.id], force: true })}>
              {s.doors[d.id] ? "Refermer" : "Forcer"}
            </button>
          )}
        </div>
      ))}
    </Section>
  );
}

function Terminals({ def, view, busy, act }: Props) {
  const s = view.state;
  const term = def.terminals.find((t) => t.id === s.terminal);
  const done = new Set(s.faults.map((f) => f.id));
  const reachable = (room: string) => (room === "hall" ? s.light : !!s.doors[room]);
  return (
    <Section title="TERMINAUX" chip={<span className={`scn-chip ${term ? "scn-chip-warn" : ""}`}>{term ? term.label.toUpperCase() : "—"}</span>}>
      <Row>
        {def.terminals.map((t) => (
          <button key={t.id} type="button" className="scn-btn scn-btn-amber" disabled={busy} onClick={() => void act({ t: "terminal", id: t.id })}>
            {t.label}
            <small>{reachable(t.room) ? t.hint : `${t.hint} · pas encore atteint`}</small>
          </button>
        ))}
      </Row>
      {term && (
        <>
          {term.files
            .filter((f) => !f.fault || done.has(f.fault))
            .map((f) => (
              <button key={f.id} type="button" className={`scn-btn text-left ${s.playing === f.id ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "play", file: f.id })}>
                ▶ {view.setup.files?.[f.id]?.name || f.name}
                <small>{view.setup.files?.[f.id]?.date || f.meta}</small>
              </button>
            ))}
          {s.playing && <MediaControls busy={busy} act={act} />}
          <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "terminal", id: null })}>
            Retour au plan
          </button>
        </>
      )}
    </Section>
  );
}

function Circuit({ view, busy, act }: { view: ConsoleView; busy: boolean; act: Act }) {
  const s = view.state;
  const want = view.setup.params.circuit;
  return (
    <Section title="CIRCUIT · PANIC ROOM" chip={<span className={`scn-chip ${s.panicReady ? "scn-chip-ok" : "scn-chip-bad"}`}>{s.panicReady ? "OPÉRATIONNELLE" : "HORS SERVICE"}</span>}>
      <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "circuit", show: !s.circuitShown })}>
        {s.circuitShown ? "Ranger le boîtier" : "Afficher le boîtier"}
      </button>
      <div className="grid grid-cols-4 gap-2">
        {s.switches.map((up, i) => (
          <button key={i} type="button" className={`scn-btn scn-vt text-2xl ${up ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "switch", index: i, up: !up })}>
            {"ABCD"[i]} {up ? "▲" : "▼"}
          </button>
        ))}
      </div>
      <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "power" })}>
        Mettre sous tension
      </button>
      <p className="text-[0.68rem] text-[var(--scn-muted)]">
        Les joueurs dictent, tu bascules : l&apos;écran suit en direct. Solution (pour toi) :{" "}
        <b className="text-[var(--scn-ok)]">
          {want
            .map((up, i) => `${"ABCD"[i]} ${up ? "levé" : "baissé"}`)
            .join(" · ")}
        </b>
        .
      </p>
    </Section>
  );
}

function Faults({ def, view, busy, act }: Props) {
  const s = view.state;
  const all = [...def.faults, ...view.setup.extraFaults];
  const done = new Set(s.faults.map((f) => f.id));
  const off = new Set(s.faultsOff);
  const allOn = all.every((f) => !off.has(f.id));
  return (
    <Section title="FAILLES" chip={<span className="scn-chip">{s.faults.length} déclenchées · {all.length - off.size} actives</span>}>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        <span>Toutes les failles</span>
        <input type="checkbox" checked={allOn} disabled={busy} onChange={(e) => void act({ t: "faultToggle", id: null, on: e.target.checked })} className="h-6 w-6" />
      </label>
      {all
        .slice()
        .sort((a, b) => Number(!a.loops.includes(s.loop)) - Number(!b.loops.includes(s.loop)))
        .map((f) => (
          <div key={f.id} className="flex items-stretch gap-2">
            <input type="checkbox" aria-label={`${f.title} : activée`} checked={!off.has(f.id)} disabled={busy} onChange={(e) => void act({ t: "faultToggle", id: f.id, on: e.target.checked })} className="h-6 w-6 shrink-0 self-center" />
            <button
              type="button"
              className={`scn-btn flex-1 text-left ${done.has(f.id) ? "scn-btn-on" : f.loops.includes(s.loop) ? "scn-btn-fault" : ""}`}
              disabled={busy || off.has(f.id)}
              onClick={() => void act({ t: "fault", id: f.id })}
            >
              {done.has(f.id) ? "✓ " : ""}
              {f.title}
              <small>
                {off.has(f.id) ? "désactivée" : `boucle ${f.loops.join(" et ")}`}
                {f.kind === "terminalFile" && f.id === "hallmic" ? (view.projection.mic ? " · joue l'enregistrement de la salle" : " · joue le fichier de secours") : ""}
              </small>
            </button>
          </div>
        ))}
      <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "stop" })}>
        Arrêter la faille en cours
      </button>
    </Section>
  );
}

function Sounds({ def, view, busy, act }: Props) {
  const s = view.state;
  const categories = [...new Set(def.media.filter((m) => m.category).map((m) => m.category!))];
  return (
    <Section title="SONS" chip={<span className="scn-chip">{s.ambiances.length ? `${s.ambiances.length} en boucle` : "—"}</span>}>
      {categories.map((c) => (
        <div key={c}>
          <p className="scn-head mb-1">{c.toUpperCase()}</p>
          <Row>
            {def.media
              .filter((m) => m.category === c)
              .map((m) => {
                const on = s.ambiances.includes(m.id);
                return (
                  <button key={m.id} type="button" className={`scn-btn ${on ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act(on ? { t: "stopSound", slot: m.id } : { t: "sound", slot: m.id })}>
                    {on ? "■ " : "▶ "}
                    {m.label}
                    {m.loop && <small>{on ? "en boucle : toucher pour couper" : "en boucle"}</small>}
                  </button>
                );
              })}
          </Row>
        </div>
      ))}
      <p className="scn-head mt-1">LECTURE</p>
      <MediaControls busy={busy} act={act} />
      <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "stopSound", slot: null })}>
        Couper tous les sons
      </button>
    </Section>
  );
}

function Effects({ view, busy, act }: Props) {
  const s = view.state;
  const [text, setText] = useState("");
  return (
    <Section title="EFFETS">
      <Row>
        <button type="button" className="scn-btn scn-btn-fault" disabled={busy} onClick={() => void act({ t: "glitch" })}>
          Faille<small>la simulation fuit</small>
        </button>
        <button type="button" className={`scn-btn ${s.blizzard ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "blizzard", on: !s.blizzard })}>
          Blizzard<small>{s.blizzard ? "en cours" : "bascule"}</small>
        </button>
        <button type="button" className={`scn-btn ${s.dark ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "dark", on: !s.dark })}>
          {s.dark ? "Lever le délestage" : "Délestage"}
          <small>{s.dark ? "retour à l'éclairage normal" : "presque noir, une lampe"}</small>
        </button>
        <button type="button" className={`scn-btn ${s.gauge ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "gauge", seconds: s.gauge ? null : view.setup.params.gaugeSeconds })}>
          Jauge des générateurs<small>{s.gauge ? "arrêter" : `${Math.round(view.setup.params.gaugeSeconds / 60)} min`}</small>
        </button>
      </Row>
      <TimerControls which="gauge" timer={s.gauge} busy={busy} act={act} />
      <p className="scn-head mt-1">MINUTEUR</p>
      {s.timer ? (
        <TimerControls which="main" timer={s.timer} busy={busy} act={act} />
      ) : (
        <Row>
          {[
            ["Débat", 300],
            ["Chrono", 60],
          ].map(([label, seconds]) => (
            <button key={label} type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "timer", which: "main", cmd: "start", seconds: Number(seconds), label: String(label) })}>
              {label} · {Number(seconds) / 60} min
            </button>
          ))}
        </Row>
      )}
      <p className="scn-head mt-1">INTRUSION</p>
      {s.intrusion ? (
        <>
          <p className="rounded-lg border border-[var(--scn-magenta)] p-2 text-sm text-[var(--scn-magenta)]">{s.intrusion}</p>
          <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "intrusion", text: null })}>
            Fermer l&apos;intrusion
          </button>
        </>
      ) : (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={600} placeholder="Ce qu'elle écrit s'affiche lettre par lettre…" aria-label="Texte de l'intrusion" className="scn-field py-2" />
          <button
            type="button"
            className="scn-btn scn-btn-fault"
            disabled={busy || !text.trim()}
            onClick={async () => {
              if (!(await act({ t: "intrusion", text: text.trim() }))) setText("");
            }}
          >
            Intrusion
          </button>
        </>
      )}
    </Section>
  );
}

function Journal({ view, send }: { view: ConsoleView; send?: Send }) {
  const [target, setTarget] = useState<{ seq: number; label: string } | null>(null);
  return (
    <Section title="JOURNAL" chip={<span className="scn-chip">{view.state.log.length}</span>}>
      {send && view.marks.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer py-2 text-[var(--scn-muted)]">Revenir à un moment passé…</summary>
          <div className="flex flex-col gap-1">
            {[...view.marks].reverse().map((m) => (
              <button key={m.seq} type="button" className="scn-btn min-h-10 text-left text-xs" onClick={() => setTarget(m)}>
                ↺ {m.label}
              </button>
            ))}
          </div>
        </details>
      )}
      {target && send && (
        <div className="rounded-xl border border-[var(--scn-amber)] p-3 text-sm">
          <p>
            Revenir au début de <b>{target.label}</b> ? Tout ce qui a suivi est effacé du journal.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="scn-btn scn-btn-amber"
              onClick={async () => {
                if (!(await send({ type: "rewind", seq: target.seq }))) setTarget(null);
              }}
            >
              Revenir à ce moment
            </button>
            <button type="button" className="scn-btn" onClick={() => setTarget(null)}>
              Rester ici
            </button>
          </div>
        </div>
      )}
      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto text-xs">
        {[...view.state.log].reverse().map((l, i) => (
          <li key={i} className={i === 0 ? "" : "text-[var(--scn-muted)]"}>
            <span className="text-[var(--scn-ice-dim)]">{l.at}</span> — {l.text}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The projection's link and QR code, during the evening too: a closed window opens again in one gesture. */
function ProjectionLink({ view, qrSvg, code }: { view: ConsoleView; qrSvg: string; code: string }) {
  // Inside the side-by-side rehearsal, the link to it is pointless.
  const inFrame = useSyncExternalStore(
    () => () => undefined,
    () => window.self !== window.top,
    () => false,
  );
  return (
    <Section title="PROJECTION" chip={<span className={`scn-chip ${view.projection.connected ? "scn-chip-ok" : "scn-chip-bad"}`}>{view.projection.connected ? "connectée" : "déconnectée"}</span>}>
      <input readOnly value={view.link} onFocus={(e) => e.target.select()} aria-label="Lien de la projection" className="scn-field text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <a href={view.link} target="_blank" rel="noopener noreferrer" className="scn-btn flex items-center justify-center">
          Ouvrir la projection ↗
        </a>
        {!inFrame && (
          <a href={`/scenario/${code}/repetition`} className="scn-btn flex items-center justify-center">
            Vue côte à côte<small>téléphone + écran</small>
          </a>
        )}
      </div>
      <div className="mx-auto w-48 rounded-xl bg-white p-2" aria-label="QR code de la projection" dangerouslySetInnerHTML={{ __html: qrSvg }} />
    </Section>
  );
}

/** Deleting an evening, at any stage (a rehearsal, a false start): its journal goes with it. */
function DeleteEvening({ code, live = false }: { code: string; live?: boolean }) {
  const [asking, setAsking] = useState(false);
  const [going, setGoing] = useState(false);
  if (!asking)
    return (
      <button type="button" className="py-2 text-sm text-[var(--scn-bad)] underline" onClick={() => setAsking(true)}>
        Supprimer cette soirée
      </button>
    );
  return (
    <div className="rounded-xl border border-[var(--scn-bad)] p-3 text-sm">
      <p>{live ? "La soirée est en cours : elle s'arrête, et son journal et sa préparation sont effacés définitivement." : "Son journal et sa préparation sont effacés définitivement."}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="scn-btn scn-btn-danger"
          disabled={going}
          onClick={() => {
            setGoing(true);
            deleteEveningAction(code).catch(() => setGoing(false));
          }}
        >
          {going ? "Suppression…" : "Supprimer définitivement"}
        </button>
        <button type="button" className="scn-btn" onClick={() => setAsking(false)}>
          Garder la soirée
        </button>
      </div>
    </div>
  );
}

function Done({ code, view }: { code: string; view: ConsoleView }) {
  const [going, setGoing] = useState(false);
  const [asking, setAsking] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="scn-sec p-4 text-center">
        <p className="scn-vt text-3xl text-[var(--scn-ice)]">SOIRÉE TERMINÉE</p>
        <p className="text-sm text-[var(--scn-muted)]">{view.state.phase === "good" ? "Bonne fin : le village a démasqué le meneur." : "Mauvaise fin."}</p>
      </div>
      <Section title="RÉCAPITULATIF" open>
        <ul className="flex flex-col gap-1 text-sm">
          {view.recap.map((r) => (
            <li key={r.name}>
              <b>{r.name}</b> <span className="text-[var(--scn-muted)]">ch. {r.room}</span>
              {r.infected ? <span className="text-[var(--scn-bad)]"> · contaminé ({r.infectedAt}{r.by ? `, par ${r.by}` : ""})</span> : " · sain"}
            </li>
          ))}
        </ul>
      </Section>
      <Journal view={view} />
      <button
        type="button"
        className="scn-btn scn-btn-primary"
        disabled={going}
        onClick={() => {
          setGoing(true);
          replayEveningAction(code).catch(() => setGoing(false));
        }}
      >
        Rejouer ce scénario<small>mêmes joueurs, réglages, événements et failles</small>
      </button>
      {view.role === "host" && (
        <button type="button" className="py-2 text-sm text-[var(--scn-bad)] underline" onClick={() => setAsking(true)}>
          Supprimer cette soirée
        </button>
      )}
      {asking && (
        <div role="dialog" aria-modal="true" aria-label="Supprimer la soirée" className="scn-veil fixed inset-x-0 top-0 bottom-[4.75rem] z-50 flex items-end justify-center p-3 sm:items-center" onClick={() => setAsking(false)}>
          <div className="scn-sec w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="scn-vt text-2xl text-[var(--scn-bad)]">SUPPRIMER LA SOIRÉE ?</p>
            <p className="mt-1 text-sm text-[var(--scn-muted)]">Son journal et sa préparation sont effacés définitivement.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="scn-btn scn-btn-danger" onClick={() => void deleteEveningAction(code)}>
                Supprimer définitivement
              </button>
              <button type="button" className="scn-btn" onClick={() => setAsking(false)}>
                Garder la soirée
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
