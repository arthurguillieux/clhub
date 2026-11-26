"use client";

import { useState } from "react";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import { PROPS, SPACES, doorsFrom, otherSide, propsIn, type SpaceId, type StationDoor } from "@/modules/loups/scenarios/station";
import type { PublicScenario } from "@/modules/loups/scenarios/types";
import type { Act } from "./controls";
import { SheetFrame } from "./Station";

/**
 * The sandbox, as the players live it (the mockup of 23/11): where the group is, the doors it sees from
 * there, the furniture it can search. One tap per thing the players ask for; the room follows.
 */

type Props = { def: PublicScenario; view: ConsoleView; busy: boolean; act: Act };

const spaceName = (id: SpaceId) => {
  const n = SPACES.find((x) => x.id === id)!.name;
  return n.charAt(0) + n.slice(1).toLowerCase();
};

export function GroupCard({ def, view, busy, act, onProp }: Props & { onProp: (id: string) => void }) {
  const s = view.state;
  const here = SPACES.find((x) => x.id === s.at)!;
  const [sel, setSel] = useState<string | null>(null);
  const props = propsIn(s.at);
  return (
    <section aria-label="Le groupe" className="flex flex-col gap-2 rounded-xl border border-[#1f3a4b] bg-[#0b1218] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.62rem] font-bold tracking-[0.16em] text-[var(--scn-muted)]">LE GROUPE EST DANS</p>
          <p className="scn-vt text-3xl leading-none text-[var(--scn-ice)]">{here.name}</p>
        </div>
        <button type="button" aria-pressed={s.overview} className={`scn-btn min-h-9 px-2 text-[0.7rem] ${s.overview ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "overview", on: !s.overview })}>
          {s.overview ? "Vue globale" : "Vue suivie"}
          <small>salle</small>
        </button>
      </div>
      {here.desc && <p className="text-sm text-[var(--scn-muted)]">{here.desc}</p>}

      <p className="mt-1 text-[0.62rem] font-bold tracking-[0.16em] text-[var(--scn-ice)]">LES PORTES QU&apos;ILS VOIENT</p>
      <div className="flex flex-col gap-1.5">
        {doorsFrom(s.at).map((d) => (
          <DoorRow key={d.id} d={d} {...{ def, view, busy, act }} open={sel === d.id} onToggle={() => setSel(sel === d.id ? null : d.id)} />
        ))}
      </div>

      <p className="mt-1 text-[0.62rem] font-bold tracking-[0.16em] text-[var(--scn-amber)]">À FOUILLER</p>
      {props.length ? (
        <div className="flex flex-col gap-1.5">
          {props.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[#2c4252] bg-[#0f1a22] px-3 text-left text-sm"
              disabled={busy}
              onClick={() => {
                void act({ t: "prop", id: p.id });
                onProp(p.id);
              }}
            >
              <span>{p.name}</span>
              <span className="text-xs font-bold text-[var(--scn-amber)]">fouiller ›</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--scn-muted)]">Rien à fouiller ici pour l&apos;instant.</p>
      )}
      {s.inventory.length > 0 && (
        <p className="text-xs text-[var(--scn-ok)]">Objets du groupe : {s.inventory.map((id) => def.sandbox?.stash.find((x) => x.id === id)?.name ?? id).join(", ")}.</p>
      )}
    </section>
  );
}

function DoorRow({ d, def, view, busy, act, open, onToggle }: Props & { d: StationDoor; open: boolean; onToggle: () => void }) {
  const s = view.state;
  const door = def.doors.find((x) => x.id === (d.follows ?? d.id));
  if (!door) return null;
  const dest = otherSide(d, s.at);
  const isOpen = !!s.doors[door.id];
  const has = !door.requires || !!s.flags[door.requires];
  const thing = door.requires ? (def.sandbox?.stash.find((x) => x.flag === door.requires)?.name ?? door.hint) : null;
  const [cls, tag] = isOpen
    ? ["text-[var(--scn-ice)] border-[var(--scn-ice)]", "ouverte"]
    : door.locked
      ? ["text-[#ff3b3b] border-[#ff3b3b]", "jamais"]
      : door.requires
        ? has
          ? ["text-[var(--scn-ok)] border-[var(--scn-ok)]", `${thing} : vous l'avez`]
          : ["text-[#ff6b6b] border-[#ff6b6b]", `fermée · ${door.hint}`]
        : ["text-[var(--scn-muted)] border-[#2c4252]", "fermée"];
  const known = isOpen || dest === "hall" || dest === "sas";
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" aria-expanded={open} className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-[#0f1a22] px-3 text-left text-sm ${open ? "border-[var(--scn-ice)]" : "border-[#2c4252]"}`} onClick={onToggle}>
        <span className="flex items-center gap-2">
          <span className="scn-vt text-2xl leading-none text-[var(--scn-ice)]">{d.letter}</span>
          <span>{known ? spaceName(dest) : `Porte ${d.letter}`}</span>
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[0.66rem] font-bold ${cls}`}>{tag}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-[#1f3a4b] p-2 text-sm">
          {isOpen ? (
            <>
              <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "go", space: dest })}>
                Entrer : {spaceName(dest)}
              </button>
              {!d.follows && (
                <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "door", door: door.id, open: false })}>
                  Refermer la porte
                </button>
              )}
            </>
          ) : door.locked ? (
            <>
              <p className="text-xs text-[var(--scn-muted)]">Elle ne s&apos;ouvre jamais : la salle verra « ACCÈS REFUSÉ ».</p>
              <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "unlock", door: door.id })}>
                Ils tentent d&apos;ouvrir
              </button>
            </>
          ) : d.follows ? (
            <p className="text-xs text-[var(--scn-muted)]">Elle s&apos;ouvre avec la porte de l&apos;aile.</p>
          ) : door.requires && !has ? (
            <>
              <p className="text-xs text-[var(--scn-muted)]">Fermée : il faut {door.hint}. Le groupe ne l&apos;a pas.</p>
              <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "unlock", door: door.id })}>
                Ils tentent d&apos;ouvrir
              </button>
              <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "door", door: door.id, open: true })}>
                L&apos;ouvrir quand même<small>décision du meneur</small>
              </button>
            </>
          ) : (
            <button type="button" className="scn-btn scn-btn-primary" disabled={busy} onClick={() => void act({ t: "unlock", door: door.id })}>
              {door.requires ? `Utiliser : ${thing}` : "Ouvrir la porte"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A piece of furniture, close up: its gestures, a computer's password, what was found. */
export function PropSheet({ def, view, busy, act, id, onClose }: Props & { id: string; onClose: () => void }) {
  const s = view.state;
  const prop = PROPS.find((p) => p.id === id);
  const [typed, setTyped] = useState("");
  if (!prop) return null;
  const on = (g: string) => s.gestures.includes(`${prop.id}.${g}`);
  const hidden = Object.entries(def.sandbox?.hides ?? {}).filter(([key]) => key.startsWith(`${prop.id}.`));
  const password = def.sandbox?.passwords[prop.id];
  const powered = prop.computer ? on(prop.computer.gesture) : false;
  const close = () => {
    void act({ t: "prop", id: null });
    onClose();
  };
  return (
    <SheetFrame title={prop.name.replace(/^L'|^Le |^La /, "").toUpperCase()} sub="La salle voit la scène en gros plan. Les joueurs demandent, tu exécutes." color="var(--scn-amber)" onClose={close}>
      <div className="grid grid-cols-1 gap-1.5">
        {prop.gestures.map((g) => (
          <button key={g.id} type="button" className={`scn-btn ${on(g.id) ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "gesture", key: `${prop.id}.${g.id}`, on: !on(g.id) })}>
            {on(g.id) ? g.off : g.on}
          </button>
        ))}
      </div>
      {hidden.length > 0 && (
        <p className="text-xs text-[var(--scn-muted)]">
          Pour toi : {hidden.map(([key, thing]) => `${def.sandbox?.stash.find((x) => x.id === thing)?.name ?? thing} ${prop.gestures.find((g) => `${prop.id}.${g.id}` === key)?.on.toLowerCase().replace(/^soulever/, "sous").replace(/^ouvrir/, "dans")}`).join(", ")}
          {hidden.every(([, thing]) => s.inventory.includes(thing)) ? " — trouvé." : "."}
        </p>
      )}
      {prop.computer && powered && password && (
        <div className="flex flex-col gap-1.5">
          {s.unlocked.includes(prop.id) ? (
            <>
              <p className="text-sm text-[var(--scn-ok)]">✓ Session ouverte : la salle voit ses fichiers.</p>
              <button
                type="button"
                className="scn-btn scn-btn-amber"
                disabled={busy}
                onClick={() => {
                  void act({ t: "terminal", id: prop.computer!.terminal });
                  onClose();
                }}
              >
                Ouvrir ses fichiers<small>la caméra zoome sur l&apos;écran</small>
              </button>
            </>
          ) : (
            <>
              <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">MOT DE PASSE DICTÉ PAR LES JOUEURS</span>
              <form
                className="flex gap-1.5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!typed.trim()) return;
                  if (!(await act({ t: "password", prop: prop.id, text: typed }))) setTyped("");
                }}
              >
                <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} maxLength={24} autoComplete="off" aria-label="Mot de passe dicté par les joueurs" placeholder="tape ici" className="scn-field min-w-0 flex-1" />
                <button type="submit" className="scn-btn scn-btn-primary" disabled={busy || !typed.trim()}>
                  Taper
                </button>
              </form>
              <p className="text-xs text-[var(--scn-muted)]">
                Le bon, pour toi : <b className="text-[#ffcf7a]">{password}</b>
                {s.pwTries ? ` · ${s.pwTries} essai${s.pwTries > 1 ? "s" : ""} raté${s.pwTries > 1 ? "s" : ""}` : ""}
              </p>
            </>
          )}
        </div>
      )}
      <button type="button" className="scn-btn" onClick={close}>
        Revenir au plan
      </button>
    </SheetFrame>
  );
}
