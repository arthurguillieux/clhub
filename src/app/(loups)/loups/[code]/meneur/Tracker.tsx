"use client";

import { useState } from "react";
import {
  CAUSE_LABELS,
  WINNER_LABELS,
  barberStrike,
  dawn,
  isNight,
  isWolf,
  nightSteps,
  orderedSteps,
  outcome,
  phaseLabel,
  voteOut,
  withCascade,
  type Cause,
  type Death,
  type NightStep,
  type Winner,
} from "@/modules/loups/domain/game";
import { ROLES, roleName, roleOf, type RoleId } from "@/modules/loups/domain/roles";
import type { HostView } from "@/modules/loups/views";
import { LoupsDialog, SeatSelect, nameOf, type Send, type SeatView } from "./ui";

type Reveal = Death & { role?: RoleId };
type Play = (command: Record<string, unknown>) => Promise<string | null>;

/** The game itself: tonight's calls in order, or the day's vote and powers; the table; the log. */
export function Tracker({ view, busy, send }: { view: HostView; busy: boolean; send: Send }) {
  const play: Play = (command) => send({ type: "play", command });
  const t = view.tracker;
  const night = isNight(t.turn);
  const [ending, setEnding] = useState<Winner | null>(null);
  const result = outcome(view.seats, t);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="loups-title text-3xl">
          {night ? "🌙" : "☀️"} {phaseLabel(t.turn)}
        </h2>
        <button type="button" className="loups-btn-ghost min-h-11 px-4 text-sm" disabled={busy || !view.canUndo} onClick={() => void play({ t: "undo" })}>
          ↶ Annuler
        </button>
      </div>

      {result && (
        <div className="loups-panel flex flex-wrap items-center justify-between gap-3 border-[var(--w-rust)] p-4">
          <p className="font-semibold">🏁 {WINNER_LABELS[result]} ?</p>
          <button type="button" className="loups-btn min-h-11 px-4 text-sm" onClick={() => setEnding(result)}>
            Terminer la partie
          </button>
        </div>
      )}

      {night ? <Night view={view} busy={busy} play={play} /> : <Day view={view} busy={busy} play={play} />}

      <Table view={view} busy={busy} play={play} />
      <Journal view={view} />

      <button type="button" className="loups-btn-ghost min-h-12 px-4" onClick={() => setEnding(result ?? "village")}>
        🏁 Terminer la partie
      </button>
      {ending && <EndDialog initial={ending} plague={t.plague} busy={busy} send={send} onClose={() => setEnding(null)} />}
    </div>
  );
}

// ───────── The night ─────────

function Night({ view, busy, play }: { view: HostView; busy: boolean; play: Play }) {
  const t = view.tracker;
  const steps = nightSteps(view.seats, view.deck, t, view.nightOrder);
  const [reorder, setReorder] = useState(false);
  const [dawnOpen, setDawnOpen] = useState(false);

  const move = (i: number, by: number) => {
    const a = steps[i];
    const b = steps[i + by];
    if (!a || !b) return;
    const full = orderedSteps(view.nightOrder).map((s) => s.id as string);
    const ia = full.indexOf(a.id);
    const ib = full.indexOf(b.id);
    [full[ia], full[ib]] = [b.id, a.id];
    void play({ t: "order", order: full });
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="loups-label">Les appels de la nuit</p>
        <button type="button" className="py-2 text-sm underline" onClick={() => setReorder(!reorder)}>
          {reorder ? "Fini" : "Changer l'ordre"}
        </button>
      </div>
      {t.plague && <PlagueStep view={view} busy={busy} play={play} />}
      {steps.map((step, i) => (
        <article key={step.id} className="loups-panel p-4">
          <div className="flex items-start gap-3">
            <label className="flex min-w-0 flex-1 items-start gap-3">
              <input
                type="checkbox"
                checked={t.tonight.done.includes(step.id)}
                onChange={(e) => void play({ t: "step", step: step.id, done: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--w-rust)]"
                aria-label={`${step.label} : fait`}
              />
              <span className="min-w-0">
                <span className={`loups-title block text-lg ${t.tonight.done.includes(step.id) ? "loups-muted line-through" : ""}`}>
                  {i + 1}. {step.label}
                </span>
                <span className="loups-muted block text-sm">{step.hint}</span>
              </span>
            </label>
            {reorder && (
              <span className="flex shrink-0">
                <button type="button" aria-label={`Appeler ${step.label} plus tôt`} className="h-10 w-10" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label={`Appeler ${step.label} plus tard`} className="h-10 w-10" disabled={busy || i === steps.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </span>
            )}
          </div>
          {!reorder && (
            <div className="mt-3 flex flex-col gap-2">
              <Holders step={step} view={view} busy={busy} play={play} />
              <StepInput step={step} view={view} busy={busy} play={play} />
            </div>
          )}
        </article>
      ))}
      <button type="button" className="loups-btn min-h-14 px-6 text-lg" disabled={busy} onClick={() => setDawnOpen(true)}>
        ☀️ Le jour se lève
      </button>
      {dawnOpen && <DawnDialog view={view} busy={busy} play={play} onClose={() => setDawnOpen(false)} />}
    </section>
  );
}

/** Who holds the card called: known, or to be noted now (real cards). */
function Holders({ step, view, busy, play }: { step: NightStep; view: HostView; busy: boolean; play: Play }) {
  const t = view.tracker;
  if (step.id === "amoureux") return null;
  if (step.id === "loups") {
    const wolves = view.seats.filter((s) => s.alive && isWolf(s, t));
    const unknown = view.seats.filter((s) => s.alive && s.role === null);
    return (
      <div className="text-sm">
        {wolves.length > 0 && <p>🐺 {wolves.map((w) => w.name).join(", ")}</p>}
        {unknown.length > 0 && (
          <div className="mt-1">
            <p className="loups-muted text-xs">Qui se réveille ? Touche les loups pour les noter.</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {unknown.map((s) => (
                <button key={s.id} type="button" className="loups-chip min-h-9 px-3" disabled={busy} onClick={() => void play({ t: "wolves", seats: [s.id] })}>
                  {s.name}
                </button>
              ))}
            </div>
            {!t.plague && view.dealMode === "cards" && wolves.length === 0 && (
              <button type="button" className="mt-2 py-2 text-sm underline" disabled={busy} onClick={() => void play({ t: "plague", on: true })}>
                Personne ne se réveille : peste noire
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  const holders = view.seats.filter((s) => s.role === step.role);
  const expected = view.deck[step.role] ?? 0;
  const unknown = view.seats.filter((s) => s.alive && s.role === null);
  return (
    <div className="text-sm">
      {holders.length > 0 && <p>{holders.map((h) => `${h.name}${h.alive ? "" : " (mort)"}`).join(", ")}</p>}
      {holders.length < expected && unknown.length > 0 && (
        <SeatSelect seats={unknown} value={null} label={`Qui est ${roleName(step.role)} ?`} none={`Qui est ${roleName(step.role).toLowerCase()} ?`} disabled={busy} onChange={(id) => id && void play({ t: "assign", seat: id, role: step.role })} />
      )}
    </div>
  );
}

function StepInput({ step, view, busy, play }: { step: NightStep; view: HostView; busy: boolean; play: Play }) {
  const t = view.tracker;
  const alive = view.seats.filter((s) => s.alive);
  const [a, setA] = useState<string | null>(t.lovers?.[0] ?? null);
  const [b, setB] = useState<string | null>(t.lovers?.[1] ?? null);
  const [seen, setSeen] = useState<string | null>(null);
  switch (step.id) {
    case "cupidon":
      return (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <SeatSelect seats={alive} value={a} onChange={setA} label="Premier amoureux" none="Amoureux 1" disabled={busy} />
            <SeatSelect seats={alive} value={b} onChange={setB} label="Second amoureux" none="Amoureux 2" disabled={busy} />
          </div>
          <button type="button" className="loups-btn-ghost min-h-11 px-4 text-sm" disabled={busy || !a || !b || a === b} onClick={() => void play({ t: "lovers", a, b })}>
            {t.lovers ? "Changer les amoureux" : "❤️ Noter les amoureux"}
          </button>
        </div>
      );
    case "amoureux":
      return <p className="text-sm">{t.lovers ? `❤️ ${nameOf(view.seats, t.lovers[0])} et ${nameOf(view.seats, t.lovers[1])}` : "Note d'abord les amoureux à l'appel de Cupidon."}</p>;
    case "enfant":
      return <SeatSelect seats={alive} value={t.model} label="Modèle de l'enfant sauvage" none="Son modèle…" disabled={busy} onChange={(id) => id && void play({ t: "model", seat: id })} />;
    case "voyante": {
      const role = view.seats.find((s) => s.id === seen)?.role;
      return (
        <div className="flex flex-col gap-1">
          <SeatSelect seats={alive} value={seen} label="Joueur sondé par la voyante" none="Elle désigne…" onChange={setSeen} />
          {seen && <p className="text-sm">Sa carte : {role ? <b>{roleName(role)}</b> : "pas encore connue de toi"}</p>}
        </div>
      );
    }
    case "salvateur":
      return (
        <div className="flex flex-col gap-1">
          <SeatSelect
            seats={alive.filter((s) => s.id !== t.lastProtected)}
            value={t.tonight.protected}
            label="Joueur protégé"
            none="Il protège…"
            disabled={busy}
            onChange={(id) => void play({ t: "protect", seat: id })}
          />
          {t.lastProtected && <p className="loups-muted text-xs">La nuit dernière : {nameOf(view.seats, t.lastProtected)} (pas deux fois de suite).</p>}
        </div>
      );
    case "loups":
      return <SeatSelect seats={alive} value={t.tonight.victim} label="Victime des loups" none="Leur victime…" disabled={busy} onChange={(id) => void play({ t: "victim", seat: id })} />;
    case "infect":
      return (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={t.tonight.infect} disabled={busy || !t.tonight.victim} onChange={(e) => void play({ t: "infect", on: e.target.checked })} className="h-5 w-5 accent-[var(--w-blood)]" />
          {t.tonight.victim ? `Infecter ${nameOf(view.seats, t.tonight.victim)} au lieu de le tuer` : "Note d'abord la victime des loups"}
        </label>
      );
    case "loupblanc":
      return (
        <SeatSelect
          seats={alive.filter((s) => isWolf(s, t) && s.role !== "loupblanc")}
          value={t.tonight.whiteWolf}
          label="Loup dévoré par le loup blanc"
          none="Il épargne la meute"
          disabled={busy}
          onChange={(id) => void play({ t: "whiteWolf", seat: id })}
        />
      );
    case "sorciere":
      return (
        <div className="flex flex-col gap-2 text-sm">
          <p>Tu lui montres : {t.tonight.victim ? <b>{nameOf(view.seats, t.tonight.victim)}</b> : "personne (pas de victime notée)"}</p>
          {!t.used.heal && (
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={t.tonight.heal} disabled={busy || !t.tonight.victim} onChange={(e) => void play({ t: "witch", heal: e.target.checked, poison: t.tonight.poison })} className="h-5 w-5 accent-[var(--w-village)]" />
              🧪 Potion de vie : elle le sauve
            </label>
          )}
          {!t.used.poison && <SeatSelect seats={alive} value={t.tonight.poison} label="Victime de la potion de mort" none="☠️ Potion de mort : personne" disabled={busy} onChange={(id) => void play({ t: "witch", heal: t.tonight.heal, poison: id })} />}
          <p className="loups-muted text-xs">
            Déjà servi : {[t.used.heal && "potion de vie", t.used.poison && "potion de mort"].filter(Boolean).join(", ") || "rien"}.
          </p>
        </div>
      );
    default:
      return null;
  }
}

/** « Peste noire »: no wolf is playing, the meneur picks the victim himself. */
function PlagueStep({ view, busy, play }: { view: HostView; busy: boolean; play: Play }) {
  const t = view.tracker;
  return (
    <article className="loups-panel border-[var(--w-blood)] p-4">
      <p className="loups-title text-lg text-[var(--w-blood)]">☣️ Peste noire</p>
      <p className="loups-muted text-sm">Aucun loup ne joue : c&apos;est toi qui choisis la victime. Le village gagne s&apos;il vote contre toi.</p>
      <div className="mt-3">
        <SeatSelect seats={view.seats.filter((s) => s.alive)} value={t.tonight.victim} label="Victime de la peste" none="Ta victime…" disabled={busy} onChange={(id) => void play({ t: "victim", seat: id })} />
      </div>
      {view.dealMode === "cards" && (
        <button type="button" className="mt-2 py-2 text-sm underline" disabled={busy} onClick={() => void play({ t: "plague", on: false })}>
          Finalement, des loups se sont réveillés
        </button>
      )}
    </article>
  );
}

function DawnDialog({ view, busy, play, onClose }: { view: HostView; busy: boolean; play: Play; onClose: () => void }) {
  const d = dawn(view.seats, view.tracker);
  return (
    <LoupsDialog title="Le jour se lève" onClose={onClose}>
      {d.notes.map((n) => (
        <p key={n} className="text-sm">
          {n}
        </p>
      ))}
      <Deaths
        view={view}
        proposed={d.deaths}
        busy={busy}
        empty="Personne n'est mort cette nuit."
        confirm="Annoncer au village"
        onConfirm={async (deaths) => {
          if (!(await play({ t: "dawn", deaths }))) onClose();
        }}
      />
      <button type="button" className="loups-btn-ghost min-h-12 px-4" onClick={onClose}>
        Pas encore, la nuit continue
      </button>
    </LoupsDialog>
  );
}

/** The deaths the CLHUB proposes, to tick off (the meneur may know better), with the card each turns over. */
function Deaths({
  view,
  proposed,
  busy,
  empty,
  confirm,
  onConfirm,
}: {
  view: HostView;
  proposed: Death[];
  busy: boolean;
  empty: string;
  confirm: string;
  onConfirm: (deaths: Reveal[]) => void | Promise<void>;
}) {
  const [off, setOff] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, RoleId>>({});
  const chosen = proposed.filter((d) => !off.includes(d.seat));
  const unknown = chosen.filter((d) => view.seats.find((s) => s.id === d.seat)?.role === null);
  const notes = withCascade(view.seats, view.tracker, chosen).length > chosen.length;
  return (
    <div className="flex flex-col gap-2">
      {proposed.length === 0 && <p className="text-sm font-semibold">{empty}</p>}
      {proposed.map((d) => {
        const seat = view.seats.find((s) => s.id === d.seat);
        return (
          <div key={d.seat} className="loups-raised p-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!off.includes(d.seat)}
                onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== d.seat) : [...off, d.seat])}
                className="h-5 w-5 accent-[var(--w-blood)]"
              />
              <span>
                <b>☠️ {seat?.name}</b> <span className="loups-muted text-sm">— {CAUSE_LABELS[d.cause]}</span>
                {seat?.role && <span className="loups-muted block text-xs">{roleName(seat.role)}</span>}
              </span>
            </label>
            {seat?.role === null && !off.includes(d.seat) && (
              <select
                aria-label={`Carte de ${seat.name}`}
                value={roles[d.seat] ?? ""}
                onChange={(e) => setRoles({ ...roles, [d.seat]: e.target.value as RoleId })}
                className="loups-field mt-2 min-h-11 w-full px-3"
              >
                <option value="">Sa carte retournée…</option>
                {ROLES.filter((r) => (view.deck[r.id] ?? 0) > 0).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
      {notes && <p className="text-xs text-[var(--w-blood)]">Attention : en décochant, un amoureux resterait sans l&apos;autre.</p>}
      <button
        type="button"
        className="loups-btn-red min-h-12 px-4"
        disabled={busy || unknown.some((d) => !roles[d.seat])}
        onClick={() => void onConfirm(chosen.map((d) => (roles[d.seat] ? { ...d, role: roles[d.seat] } : d)))}
      >
        {confirm}
      </button>
    </div>
  );
}

// ───────── The day ─────────

function Day({ view, busy, play }: { view: HostView; busy: boolean; play: Play }) {
  const t = view.tracker;
  const alive = view.seats.filter((s) => s.alive);
  const holder = (role: RoleId) => view.seats.find((s) => s.role === role);
  const inDeck = (role: RoleId) => (view.deck[role] ?? 0) > 0;
  const usable = (role: RoleId) => inDeck(role) && (holder(role)?.alive ?? alive.some((s) => s.role === null));
  const lastNight = t.log.filter((l) => l.turn === t.turn - 1);

  return (
    <section className="flex flex-col gap-3">
      {lastNight.length > 0 && (
        <div className="loups-panel p-4 text-sm">
          <p className="loups-label">Cette nuit</p>
          <ul className="mt-2 flex flex-col gap-1">
            {lastNight.map((l, i) => (
              <li key={i}>{l.text}</li>
            ))}
          </ul>
        </div>
      )}
      <Bear view={view} />
      <Vote view={view} busy={busy} play={play} />
      {usable("barbier") && !t.used.barbier && <Barber view={view} busy={busy} play={play} />}
      {usable("juge") && !t.used.juge && (
        <button type="button" className="loups-btn-ghost min-h-12 px-4" disabled={busy} onClick={() => void play({ t: "judge" })}>
          ⚖️ Le juge demande un second vote
        </button>
      )}
      <OtherDeath view={view} busy={busy} play={play} />
      <button type="button" className="loups-btn min-h-14 px-6 text-lg" disabled={busy} onClick={() => void play({ t: "dusk" })}>
        🌙 La nuit tombe
      </button>
    </section>
  );
}

/** The bear growls if a wolf sits right next to its tamer (dead players leave their seat). */
function Bear({ view }: { view: HostView }) {
  const tamer = view.seats.find((s) => s.role === "montreur" && s.alive);
  if (!tamer) return null;
  const alive = view.seats.filter((s) => s.alive).sort((a, b) => a.position - b.position);
  const i = alive.findIndex((s) => s.id === tamer.id);
  const next = [alive[(i + 1) % alive.length], alive[(i - 1 + alive.length) % alive.length]].filter((s) => s && s.id !== tamer.id);
  const growl = next.some((s) => s && isWolf(s, view.tracker));
  return <p className="loups-panel p-4 text-sm">🐻 {growl ? <b>L&apos;ours grogne !</b> : "L'ours reste silencieux."}</p>;
}

function Vote({ view, busy, play }: { view: HostView; busy: boolean; play: Play }) {
  const t = view.tracker;
  const [target, setTarget] = useState<string | null>(null);
  const [servant, setServant] = useState(false);
  const alive = view.seats.filter((s) => s.alive);
  const maid = view.seats.find((s) => s.role === "servante" && s.alive);
  const result = target ? voteOut(view.seats, t, target) : null;
  const done = (failed: string | null) => {
    if (!failed) {
      setTarget(null);
      setServant(false);
    }
  };
  return (
    <article className="loups-panel p-4">
      <p className="loups-title text-lg">🗳️ Le vote du village</p>
      <div className="mt-2 flex flex-col gap-2">
        <SeatSelect seats={alive} value={target} onChange={setTarget} label="Joueur éliminé par le vote" none="Le village désigne…" disabled={busy} />
        {target && maid && !t.used.servante && maid.id !== target && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={servant} onChange={(e) => setServant(e.target.checked)} className="h-5 w-5 accent-[var(--w-rust)]" />
            La servante ({maid.name}) se dévoile et prend sa carte
          </label>
        )}
        {result?.spared && (
          <>
            <p className="text-sm">C&apos;est l&apos;idiot du village : il dévoile sa carte et reste en vie, mais ne votera plus.</p>
            <button type="button" className="loups-btn-ghost min-h-12 px-4" disabled={busy} onClick={async () => done(await play({ t: "vote", target, spared: true, servant: null, deaths: [] }))}>
              Gracier l&apos;idiot
            </button>
          </>
        )}
        {result && !result.spared && (
          <Deaths
            key={target}
            view={view}
            proposed={result.deaths}
            busy={busy}
            empty=""
            confirm="Valider le vote"
            onConfirm={async (deaths) => done(await play({ t: "vote", target, spared: false, servant: servant ? maid?.id : null, deaths }))}
          />
        )}
        {!target && (
          <button type="button" className="py-2 text-sm underline" disabled={busy} onClick={() => void play({ t: "vote", target: null, spared: false, servant: null, deaths: [] })}>
            Le village n&apos;élimine personne
          </button>
        )}
      </div>
    </article>
  );
}

function Barber({ view, busy, play }: { view: HostView; busy: boolean; play: Play }) {
  const t = view.tracker;
  const known = view.seats.find((s) => s.role === "barbier" && s.alive);
  const [barber, setBarber] = useState<string | null>(known?.id ?? null);
  const [target, setTarget] = useState<string | null>(null);
  const [card, setCard] = useState<RoleId | "">("");
  const alive = view.seats.filter((s) => s.alive);
  const victim = view.seats.find((s) => s.id === target);
  // Turning the victim's card over decides who dies: with real cards, the meneur tells which it is.
  const seats: SeatView[] = view.seats.map((s) => (s.id === target && s.role === null && card ? { ...s, role: card } : s.id === barber && s.role === null ? { ...s, role: "barbier" } : s));
  const ready = barber && target && barber !== target && (victim?.role !== null || card);
  return (
    <article className="loups-panel p-4">
      <p className="loups-title text-lg">✂️ Le barbier frappe</p>
      <div className="mt-2 flex flex-col gap-2">
        {!known && <SeatSelect seats={alive.filter((s) => s.role === null)} value={barber} onChange={setBarber} label="Le barbier" none="Qui est le barbier ?" disabled={busy} />}
        <SeatSelect seats={alive.filter((s) => s.id !== barber)} value={target} onChange={setTarget} label="Victime du barbier" none="Il tue…" disabled={busy} />
        {victim && victim.role === null && (
          <select aria-label={`Carte de ${victim.name}`} value={card} onChange={(e) => setCard(e.target.value as RoleId)} className="loups-field min-h-11 w-full px-3">
            <option value="">Sa carte retournée…</option>
            {ROLES.filter((r) => (view.deck[r.id] ?? 0) > 0).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        {ready && barber && target && (
          <Deaths
            key={`${target}-${card}`}
            view={{ ...view, seats }}
            proposed={barberStrike(seats, t, barber, target)}
            busy={busy}
            empty=""
            confirm="Le barbier a frappé"
            onConfirm={async (deaths) => {
              const reveal = deaths.map((d) => (d.seat === target && card ? { ...d, role: card } : d.seat === barber && !known ? { ...d, role: "barbier" as RoleId } : d));
              if (!known && !reveal.some((d) => d.seat === barber)) await play({ t: "assign", seat: barber, role: "barbier" });
              await play({ t: "barber", barber, deaths: reveal });
            }}
          />
        )}
      </div>
    </article>
  );
}

/** Any other death: the hunter's shot, a player who leaves, the meneur's call. */
function OtherDeath({ view, busy, play }: { view: HostView; busy: boolean; play: Play }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [cause, setCause] = useState<Cause>("chasseur");
  const hunterGone = view.seats.some((s) => s.role === "chasseur" && !s.alive);
  if (!open)
    return (
      <button type="button" className="py-2 text-sm underline" onClick={() => setOpen(true)}>
        {hunterGone ? "🏹 Le tir du chasseur, ou une autre mort" : "☠️ Une autre mort (chasseur, joueur qui part…)"}
      </button>
    );
  return (
    <article className="loups-panel p-4">
      <p className="loups-title text-lg">☠️ Une autre mort</p>
      <div className="mt-2 flex flex-col gap-2">
        <select aria-label="Cause" value={cause} onChange={(e) => setCause(e.target.value as Cause)} className="loups-field min-h-11 w-full px-3">
          <option value="chasseur">Le chasseur tire</option>
          <option value="meneur">Le meneur tue (peste noire)</option>
          <option value="autre">Autre</option>
        </select>
        <SeatSelect seats={view.seats.filter((s) => s.alive)} value={who} onChange={setWho} label="Joueur qui meurt" none="Qui meurt ?" disabled={busy} />
        {who && (
          <Deaths
            key={`${who}-${cause}`}
            view={view}
            proposed={withCascade(view.seats, view.tracker, [{ seat: who, cause }])}
            busy={busy}
            empty=""
            confirm="Confirmer"
            onConfirm={async (deaths) => {
              if (!(await play({ t: "kill", deaths }))) {
                setWho(null);
                setOpen(false);
              }
            }}
          />
        )}
        <button type="button" className="py-2 text-sm underline" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </div>
    </article>
  );
}

// ───────── The table, the log, the end ─────────

function Table({ view, busy, play }: { view: HostView; busy: boolean; play: Play }) {
  const t = view.tracker;
  const alive = view.seats.filter((s) => s.alive).length;
  return (
    <details className="loups-panel p-4" open>
      <summary className="cursor-pointer font-bold">
        La table · {alive} en vie sur {view.seats.length}
      </summary>
      <ul className="mt-3 flex flex-col gap-1.5">
        {view.seats.map((s) => {
          const wolf = isWolf(s, t);
          const marks = [
            t.lovers?.includes(s.id) && "❤️",
            t.model === s.id && "🌱 modèle",
            t.infected.includes(s.id) && "☣️ infecté",
            s.role === "enfant" && t.transformed && "🐺 devenu loup",
            t.tonight.protected === s.id && "🛡️",
            t.tonight.victim === s.id && "🎯",
            s.role === "ancien" && t.elderHit && "1 vie",
            s.role === "idiot" && t.idiotSpared && "gracié",
          ].filter(Boolean);
          return (
            <li key={s.id} className={`loups-raised flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 ${s.alive ? "" : "opacity-60"}`}>
              <span className={`font-semibold ${s.alive ? "" : "line-through"}`}>{s.name}</span>
              {s.role ? (
                <span className={`loups-chip ${wolf ? "loups-chip-wolf" : "loups-chip-village"}`}>{roleOf(s.role)?.name ?? s.role}</span>
              ) : s.alive ? (
                <select
                  aria-label={`Carte de ${s.name}`}
                  value=""
                  disabled={busy}
                  onChange={(e) => e.target.value && void play({ t: "assign", seat: s.id, role: e.target.value })}
                  className="loups-field min-h-9 px-2 text-xs"
                >
                  <option value="">carte ?</option>
                  {ROLES.filter((r) => (view.deck[r.id] ?? 0) > 0).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="loups-chip">carte ?</span>
              )}
              {marks.map((m) => (
                <span key={String(m)} className="text-xs">
                  {m}
                </span>
              ))}
              {!s.alive && s.diedTurn && (
                <span className="loups-muted w-full text-xs">
                  {phaseLabel(s.diedTurn)} · {CAUSE_LABELS[(s.cause ?? "autre") as Cause] ?? "mort"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function Journal({ view }: { view: HostView }) {
  const log = view.tracker.log;
  if (log.length === 0) return null;
  const turns = [...new Set(log.map((l) => l.turn))].reverse();
  return (
    <details className="loups-panel p-4">
      <summary className="cursor-pointer font-bold">📜 Le journal</summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        {turns.map((turn) => (
          <div key={turn}>
            <p className="loups-label">{phaseLabel(turn)}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {log
                .filter((l) => l.turn === turn)
                .map((l, i) => (
                  <li key={i}>{l.text}</li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function EndDialog({ initial, plague, busy, send, onClose }: { initial: Winner; plague: boolean; busy: boolean; send: Send; onClose: () => void }) {
  const [winner, setWinner] = useState<Winner>(initial);
  const [black, setBlack] = useState(plague);
  return (
    <LoupsDialog title="Fin de la partie" onClose={onClose}>
      <fieldset className="flex flex-col gap-1">
        <legend className="loups-muted mb-1 text-sm">Qui a gagné ?</legend>
        {(Object.keys(WINNER_LABELS) as Winner[]).map((w) => (
          <label key={w} className="flex min-h-11 items-center gap-3">
            <input type="radio" name="winner" checked={winner === w} onChange={() => setWinner(w)} className="h-5 w-5 accent-[var(--w-rust)]" />
            {WINNER_LABELS[w]}
          </label>
        ))}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={black} onChange={(e) => setBlack(e.target.checked)} className="h-5 w-5 accent-[var(--w-blood)]" />
        C&apos;était une peste noire (aucun loup tiré)
      </label>
      {black && <p className="loups-muted text-xs">Le village gagne s&apos;il a voté contre toi ; sinon, personne ne gagne.</p>}
      <button type="button" className="loups-btn min-h-12 px-4" disabled={busy} onClick={() => void send({ type: "end", winner, blackPlague: black })}>
        Terminer : {WINNER_LABELS[winner].toLowerCase()}
      </button>
      <button type="button" className="loups-btn-ghost min-h-12 px-4" onClick={onClose}>
        Continuer la partie
      </button>
    </LoupsDialog>
  );
}
