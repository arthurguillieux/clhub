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

/**
 * What a room holds for the group (in the room's sheet, opened from the plan — the home is the plan only,
 * Arthur 27/11): the group sent there, the doors one sees from it, the furniture one can search.
 */
export function RoomContents({ def, view, busy, act, space, onProp }: Props & { space: SpaceId; onProp: (id: string) => void }) {
  const s = view.state;
  const [sel, setSel] = useState<string | null>(null);
  const props = propsIn(space);
  const here = s.at === space;
  return (
    <section aria-label="Dans cette pièce" className="flex flex-col gap-2">
      {space !== "alpha" && (
        <button type="button" className={`scn-btn ${here ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "go", space })}>
          {here ? "Le groupe est ici" : "Le groupe va ici"}
          <small>la salle suit le groupe</small>
        </button>
      )}
      <p className="mt-1 text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-ice)]">LES PORTES QU&apos;ON Y VOIT</p>
      <div className="flex flex-col gap-1.5">
        {doorsFrom(space).map((d) => (
          <DoorRow key={d.id} d={d} from={space} {...{ def, view, busy, act }} open={sel === d.id} onToggle={() => setSel(sel === d.id ? null : d.id)} />
        ))}
      </div>
      {props.length > 0 && (
        <>
          <p className="mt-1 text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">À FOUILLER</p>
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
        </>
      )}
      {s.inventory.length > 0 && (
        <p className="text-xs text-[var(--scn-ok)]">Objets du groupe : {s.inventory.map((id) => def.sandbox?.objets[id]?.name ?? id).join(", ")}.</p>
      )}
    </section>
  );
}

function DoorRow({ d, from, def, view, busy, act, open, onToggle }: Props & { d: StationDoor; from: SpaceId; open: boolean; onToggle: () => void }) {
  const s = view.state;
  const door = def.doors.find((x) => x.id === (d.follows ?? d.id));
  if (!door) return null;
  const dest = otherSide(d, from);
  const isOpen = !!s.doors[door.id];
  const has = !door.requires || !!s.flags[door.requires];
  const thing = door.requires ? (Object.values(def.sandbox?.objets ?? {}).find((x) => x.flag === door.requires)?.name ?? door.hint) : null;
  const [cls, tag] = isOpen
    ? ["text-[var(--scn-ice)] border-[var(--scn-ice)]", "ouverte"]
    : door.locked
      ? ["text-[#ff3b3b] border-[#ff3b3b]", "jamais"]
      : door.requires
        ? has
          ? ["text-[var(--scn-ok)] border-[var(--scn-ok)]", `${thing} : vous l'avez`]
          : ["text-[#ff6b6b] border-[#ff6b6b]", `fermée · ${door.hint}`]
        : ["text-[var(--scn-muted)] border-[#2c4252]", "fermée"];
  const known = true;
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

/**
 * A piece of furniture, close up (V1.4): its gestures; for the meneur only, what each hiding place holds
 * (after any secret swap) and the swap itself; the visit's count; the text of what was found opens in the reader.
 */
export function PropSheet({ def, view, busy, act, id, onClose, onRead }: Props & { id: string; onClose: () => void; onRead: (textId: string) => void }) {
  const s = view.state;
  const prop = PROPS.find((p) => p.id === id);
  const [swapWith, setSwapWith] = useState("");
  if (!prop) return null;
  const on = (g: string) => s.gestures.includes(`${prop.id}.${g}`);
  const box = def.sandbox?.cachettes ?? {};
  const holds = (key: string) => box[s.swaps?.[key] ?? key];
  const limit = view.setup.params.searchesPerVisit ?? 1;
  const live = view.status === "live";
  const facesOff = def.faults.every((f) => s.faultsOff.includes(f.id));
  // The other hiding places of the room, not opened yet: what this one can be swapped with.
  const others = PROPS.filter((p) => p.space === prop.space)
    .flatMap((p) => p.gestures.map((g) => ({ key: `${p.id}.${g.id}`, label: g.on })))
    .filter((x) => !x.key.startsWith(`${prop.id}.`) && !s.opened[x.key] && (box[x.key] || box[s.swaps?.[x.key] ?? ""]));
  const close = () => {
    void act({ t: "prop", id: null });
    onClose();
  };
  return (
    <SheetFrame title={prop.name.replace(/^L'|^Le |^La |^Les /, "").toUpperCase()} sub="La salle voit la scène en gros plan. Les joueurs choisissent, tu touches le geste." color="var(--scn-amber)" onClose={close}>
      {live && limit > 0 && (
        <p className="text-xs text-[var(--scn-muted)]">
          Cette visite : {s.visitSearched.length} / {limit} cachette{limit > 1 ? "s" : ""} ouverte{s.visitSearched.length > 1 ? "s" : ""}.
        </p>
      )}
      <div className="grid grid-cols-1 gap-1.5">
        {prop.gestures.map((g) => {
          const key = `${prop.id}.${g.id}`;
          const content = s.opened[key] ?? holds(key);
          if (content && box[s.swaps?.[key] ?? key]?.faille && facesOff) return null;
          return (
            <div key={g.id} className="flex flex-col gap-1">
              <button
                type="button"
                className={`scn-btn ${on(g.id) ? "scn-btn-on" : ""}`}
                disabled={busy}
                onClick={async () => {
                  const fresh = !on(g.id) && !s.opened[key] && content;
                  if (!(await act({ t: "gesture", key, on: !on(g.id) })) && fresh && live) onRead(content.texte);
                }}
              >
                {on(g.id) ? g.off : g.on}
              </button>
              {content && (
                <p className="px-1 text-xs text-[var(--scn-muted)]">
                  {s.opened[key] ? "✓ trouvé : " : "Pour toi : "}
                  {content.contenu}
                  {content.objet ? ` → ${def.sandbox?.objets[content.objet]?.name ?? content.objet}` : ""} · {content.texte}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {others.length > 0 && prop.gestures.some((g) => !s.opened[`${prop.id}.${g.id}`]) && (
        <details className="text-sm">
          <summary className="cursor-pointer py-1 text-[var(--scn-muted)]">Échanger en secret avec une autre cachette de la pièce</summary>
          <p className="mt-1 text-xs text-[var(--scn-muted)]">Si la salle choisit ici alors que l&apos;objet est ailleurs : échange avant de toucher le geste. Noté au journal, invisible pour la salle.</p>
          <div className="mt-1.5 flex gap-1.5">
            <select value={swapWith} onChange={(e) => setSwapWith(e.target.value)} aria-label="Cachette à échanger" className="scn-field min-w-0 flex-1">
              <option value="">Avec…</option>
              {others.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label} ({holds(o.key)?.objet ? def.sandbox?.objets[holds(o.key)!.objet!]?.name : "histoire"})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="scn-btn"
              disabled={busy || !swapWith}
              onClick={async () => {
                const key = `${prop.id}.${prop.gestures.find((g) => !s.opened[`${prop.id}.${g.id}`])!.id}`;
                if (!(await act({ t: "swap", a: key, b: swapWith }))) setSwapWith("");
              }}
            >
              Échanger
            </button>
          </div>
        </details>
      )}
      <button type="button" className="scn-btn" onClick={close}>
        Revenir au plan
      </button>
    </SheetFrame>
  );
}
