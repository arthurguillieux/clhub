"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { alive, contagionActive, dawnDeaths, momentOf, nightSteps, pack, proposals, type Action, type NightStepId } from "@/modules/loups/scenarios/engine";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import type { PublicScenario } from "@/modules/loups/scenarios/types";
import { consoleAction, deleteEveningAction, replayEveningAction } from "../../actions";
import { Prep } from "./Prep";

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
          <Players def={def} view={view} busy={busy} act={act} />
          <Base def={def} view={view} busy={busy} act={act} />
          <Terminals def={def} view={view} busy={busy} act={act} />
          <Circuit view={view} busy={busy} act={act} />
          <Faults def={def} view={view} busy={busy} act={act} />
          <Sounds def={def} view={view} busy={busy} act={act} />
          <Effects def={def} view={view} busy={busy} act={act} />
          <Journal view={view} send={send} />
          {view.role === "host" && <DeleteEvening code={code} live />}
        </>
      )}
      {view.status === "done" && <Done code={code} view={view} />}
      {view.status === "live" && <CommandBar view={view} busy={busy} act={act} send={send} />}
    </div>
  );
}

/**
 * Always there, one gesture away, above everything (no dialog ever covers it): Stop, the neutral
 * screen, Annuler. The meneur is never stuck.
 */
function CommandBar({ view, busy, act, send }: { view: ConsoleView; busy: boolean; act: Act; send: Send }) {
  const s = view.state;
  return (
    <nav aria-label="Commandes" className="fixed inset-x-0 bottom-0 z-[70] border-t border-[var(--scn-line)] bg-[rgba(12,18,24,.97)] px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1.5">
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
            {s.loop === 1 ? "Lis ton texte. Lance le moteur du bus dans Sons." : `Boucle ${s.loop} : retour dans le bus. Les cartes sont redistribuées.`}
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
          <p className="text-sm text-[var(--scn-muted)]">Le groupe explore. Distribue les cartes, puis note le patient zéro.</p>
          <PlayerSelect players={living} value={choice || s.patientZero || ""} onChange={setChoice} label="Patient zéro" none="Patient zéro…" />
          <Row>
            <button type="button" className="scn-btn" disabled={busy || !choice} onClick={pick((id) => act({ t: "patientZero", player: id }))}>
              Noter le patient zéro
            </button>
            <button type="button" className="scn-btn scn-btn-primary" disabled={busy || !s.patientZero} onClick={() => void act({ t: "night" })}>
              🌙 La nuit tombe
            </button>
          </Row>
          {s.patientZero && <p className="text-xs text-[var(--scn-ok)]">Patient zéro : {s.players.find((x) => x.id === s.patientZero)?.name}</p>}
        </>
      )}
      {s.phase === "night" && <NightWizard def={def} view={view} busy={busy} act={act} />}
      {s.phase === "day" && (
        <>
          {s.event && <DayEvent view={view} busy={busy} act={act} def={def} />}
          <PlayerSelect players={living} value={choice} onChange={setChoice} label="Exilé par le vote" none="Le village exile…" />
          <Row>
            <button type="button" className="scn-btn" disabled={busy || !choice} onClick={pick((id) => act({ t: "exile", player: id }))}>
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
          </details>
        </>
      )}
      {s.phase === "loopEnd" && (
        <>
          <p className="text-sm">Boucle {s.loop} terminée : victoire {s.winner === "village" ? "du village" : "de la meute"}.</p>
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => (s.loop < view.setup.params.loops ? void act({ t: "reboot" }) : setConfirmBad(true))}>
            {s.loop < view.setup.params.loops ? `⟳ Reboot : boucle ${s.loop + 1}` : "Mauvaise fin"}
            <small>{s.loop < view.setup.params.loops ? "les chambres des morts seront scellées" : "dernière boucle : les indices manqués défilent"}</small>
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
      {(s.phase === "day" || s.phase === "night" || s.phase === "arrival" || s.phase === "loopEnd") && (
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
                Revenir au jour
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
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

function DayEvent({ def, view, busy, act }: Props) {
  const s = view.state;
  const event = view.setup.events.find((e) => e.id === s.event);
  if (!event) return null;
  void def;
  return (
    <div className="rounded-xl border border-[var(--scn-ice-dim)] p-3">
      <p className="scn-vt text-xl text-[var(--scn-ice)]">{event.name.toUpperCase()}</p>
      <p className="text-sm">{event.rule}</p>
      {event.effect === "gauge" && (
        <button type="button" className="scn-btn mt-2 w-full" disabled={busy} onClick={() => void act({ t: "gauge", seconds: s.gauge ? null : view.setup.params.gaugeSeconds })}>
          {s.gauge ? "Arrêter la jauge" : `Lancer la jauge (${Math.round(view.setup.params.gaugeSeconds / 60)} min)`}
        </button>
      )}
    </div>
  );
}

const STEP_LABELS: Record<NightStepId, string> = { panic: "Panic room", tapes: "Bandes de surveillance", infect: "La meute contamine", victim: "La meute tue", items: "Seringues", dead: "Les morts" };

/** One step at a time, none forgotten: « Passer » moves on. */
function NightWizard({ def, view, busy, act }: Props) {
  const s = view.state;
  const params = view.setup.params;
  const steps = nightSteps(s, params);
  const current = steps.find((x) => !s.tonight.done.includes(x)) ?? null;
  const [choice, setChoice] = useState("");
  const [proposed, setProposed] = useState<string[]>(s.tonight.proposed.length ? s.tonight.proposed : proposals(s, view.setup));
  const living = alive(s);
  const go = async (action: Action) => {
    if (!(await act(action))) setChoice("");
  };
  const name = (id: string | null) => s.players.find((x) => x.id === id)?.name ?? "personne";
  const deaths = dawnDeaths(s);

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-wrap gap-1 text-[0.66rem]">
        {steps.map((step, i) => (
          <li key={step} className={`scn-chip ${s.tonight.done.includes(step) ? "scn-chip-ok" : step === current ? "scn-chip-warn" : ""}`}>
            {i + 1}. {STEP_LABELS[step]}
          </li>
        ))}
      </ol>
      {s.tonight.tapes && (
        <p className={`scn-vt rounded-xl border-2 py-2 text-center text-4xl tracking-[0.2em] ${s.tonight.tapes.infected ? "border-[var(--scn-bad)] text-[var(--scn-bad)]" : "border-[var(--scn-ok)] text-[var(--scn-ok)]"}`}>
          {name(s.tonight.tapes.target).toUpperCase()} : {s.tonight.tapes.infected ? "CONTAMINÉ" : "SAIN"}
        </p>
      )}
      <p className="text-xs text-[var(--scn-muted)]">
        Meute : {pack(s).map((x) => x.name).join(", ") || "personne"}
        {contagionActive(s, params) ? "" : " · la contagion est finie"}
      </p>
      {current === "panic" && (
        <>
          <p className="text-sm">Qui passe la nuit dans la panic room ? (protégé, et hors de la meute s&apos;il est contaminé)</p>
          <PlayerSelect players={living} value={choice} onChange={setChoice} label="Joueur en panic room" none="Personne" />
          <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void go({ t: "panic", player: choice || null })}>
            {choice ? "L'enfermer pour la nuit" : "Passer : personne"}
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
      {current === "dead" && (
        <>
          <p className="text-sm">Les morts choisissent l&apos;événement de demain parmi :</p>
          <div className="flex flex-wrap gap-1.5">
            {view.setup.events.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`scn-btn min-h-10 px-3 text-xs ${proposed.includes(e.id) ? "scn-btn-on" : ""}`}
                onClick={() => setProposed(proposed.includes(e.id) ? proposed.filter((x) => x !== e.id) : [...proposed, e.id])}
              >
                {e.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--scn-muted)]">Touche un événement pour le proposer ou le retirer. Puis leur choix :</p>
          <div className="flex flex-col gap-1.5">
            {proposed.map((id) => {
              const e = view.setup.events.find((x) => x.id === id);
              return e ? (
                <button
                  key={id}
                  type="button"
                  className="scn-btn scn-btn-primary text-left"
                  disabled={busy}
                  onClick={async () => {
                    if (!(await act({ t: "propose", events: proposed }))) await act({ t: "deadChoose", event: id });
                  }}
                >
                  Les morts choisissent : {e.name}
                  <small>{e.rule}</small>
                </button>
              ) : null;
            })}
          </div>
          <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "skip", step: "dead" })}>
            Passer : pas d&apos;événement
          </button>
        </>
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
  const holderName = (id: string) => s.players.find((x) => x.id === s.items[id]?.holder)?.name;
  return (
    <>
      <p className="rounded-xl border border-[var(--scn-line)] p-2 text-sm">
        Victime de la nuit : {victim ? <b className="text-[var(--scn-bad)]">{victim.name}</b> : s.tonight.victim ? "aucune (panic room)" : "aucune"}
      </p>
      {held
        .filter((i) => i.effect === "life")
        .map((i) => (
          <button key={i.id} type="button" className="scn-btn scn-btn-on" disabled={busy || !victim} onClick={() => victim && void act({ t: "useItem", item: i.id, target: victim.id })}>
            {i.name} ({holderName(i.id)}) : {victim ? `sauver ${victim.name}` : "personne à sauver"}
            <small>annule la mort, pas la contamination</small>
          </button>
        ))}
      {held
        .filter((i) => i.effect === "death")
        .map((i) => (
        <div key={i.id} className="flex flex-col gap-1.5">
          <p className="text-sm">
            {i.name} ({holderName(i.id)}) :
          </p>
          <PlayerSelect players={alive(s)} value={targets[i.id] ?? ""} onChange={(v) => setTargets({ ...targets, [i.id]: v })} label={`Cible de ${i.name}`} none="Cible…" />
          <button type="button" className="scn-btn" disabled={busy || !targets[i.id]} onClick={() => void act({ t: "useItem", item: i.id, target: targets[i.id] ?? null })}>
            Utiliser
          </button>
        </div>
      ))}
      <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "skip", step: "items" })}>
        Fini avec les objets
      </button>
    </>
  );
}

// ───────── Players ─────────

function Players({ def, view, busy, act }: Props) {
  const s = view.state;
  const [give, setGive] = useState<{ item: string; player: string }>({ item: "", player: "" });
  return (
    <Section title="JOUEURS" chip={<span className="scn-chip">{alive(s).length} en vie · meute {pack(s).length}</span>}>
      <ul className="flex flex-col gap-1">
        {s.players.map((p) => {
          const item = def.items.find((i) => s.items[i.id]?.holder === p.id && !s.items[i.id]?.used);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--scn-line)] px-2 py-1.5 text-sm">
              <span className={`min-w-0 flex-1 ${p.status === "alive" ? "" : "text-[var(--scn-muted)] line-through"}`}>
                {p.name} <span className="text-[0.66rem] text-[var(--scn-muted)]">ch. {p.room}</span>
              </span>
              {p.infected && <span className="scn-chip scn-chip-bad">contaminé · {p.infectedAt}</span>}
              {s.tonight.panic === p.id && <span className="scn-chip scn-chip-ok">panic room</span>}
              {item && <span className="scn-chip scn-chip-warn">{item.name}</span>}
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
      <p className="scn-head mt-2">CONFIER UN OBJET</p>
      <select aria-label="Objet" value={give.item} onChange={(e) => setGive({ ...give, item: e.target.value })} className="scn-field">
        <option value="">Objet…</option>
        {def.items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
            {s.items[i.id]?.used ? " (utilisé)" : s.items[i.id]?.holder ? ` (${s.players.find((x) => x.id === s.items[i.id]?.holder)?.name})` : ""}
          </option>
        ))}
      </select>
      <Row>
        <PlayerSelect players={alive(s)} value={give.player} onChange={(v) => setGive({ ...give, player: v })} label="Joueur qui reçoit l'objet" none="Personne" />
        <button type="button" className="scn-btn" disabled={busy || !give.item} onClick={() => void act({ t: "giveItem", item: give.item, player: give.player || null })}>
          Confier
        </button>
      </Row>
      {def.items
        .filter((i) => i.effect === "pistol" && s.items[i.id]?.holder && !s.items[i.id]?.used)
        .map((i) => (
          <PistolShot key={i.id} item={i.id} view={view} busy={busy} act={act} />
        ))}
    </Section>
  );
}

function PistolShot({ item, view, busy, act }: { item: string; view: ConsoleView; busy: boolean; act: Act }) {
  const [target, setTarget] = useState("");
  return (
    <Row>
      <PlayerSelect players={alive(view.state)} value={target} onChange={setTarget} label="Cible du pistolet" none="Le pistolet vise…" />
      <button type="button" className="scn-btn scn-btn-danger" disabled={busy || !target} onClick={() => void act({ t: "useItem", item, target })}>
        Tirer
      </button>
    </Row>
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
        <button type="button" className={`scn-btn ${s.aurora ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "aurora", on: !s.aurora })}>
          Aurore australe<small>{s.aurora ? "en cours" : "bascule"}</small>
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
