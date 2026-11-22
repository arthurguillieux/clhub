"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { LOADING_MS, momentOf, protocolOf } from "@/modules/loups/scenarios/engine";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import type { PublicScenario } from "@/modules/loups/scenarios/types";
import { MediaControls, TimerControls, type Act } from "./controls";

/**
 * The station, on its own: the base's plan, to pilot with a finger, whatever game is played in it
 * (« Antarctica, c'est le contenant »). Touch a door to open it, a zone for its sheet, a room for its
 * subject; « Toute la base » for what touches the whole station. The scenario comes on top (Protocole).
 */

type Props = { def: PublicScenario; view: ConsoleView; busy: boolean; act: Act };
export type Sheet = { kind: "zone"; id: string } | { kind: "room"; room: number } | { kind: "global" } | { kind: "screen" } | null;

// The plan of the phone, in its own units (358 × 446): the zones, the corridors, the doors in the walls.
const W = 358;
const H = 446;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const box = (x: number, y: number, w: number, h: number) => ({ left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H) });

interface Zone {
  id: string;
  name: string;
  /** The door that opens it (none: the hall, lit or not). */
  door: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  extra: string;
  terminal?: string;
  ambiance?: string;
}

const ZONES: Zone[] = [
  { id: "hall", name: "HALL", door: null, x: 0, y: 0, w: 186, h: 108, extra: "accueil · terminal", terminal: "accueil" },
  { id: "sas", name: "SAS", door: "sas", x: 190, y: 0, w: 58, h: 108, extra: "hangar", ambiance: "son-vent" },
  { id: "beta", name: "ARCHIVES", door: "beta", x: 20, y: 126, w: 110, h: 70, extra: "panic room · terminal", terminal: "beta" },
  { id: "generateurs", name: "GÉNÉRAT.", door: "generateurs", x: 134, y: 126, w: 114, h: 70, extra: "la jauge", ambiance: "son-generateurs" },
  { id: "gamma", name: "INFIRMERIE", door: "gamma", x: 20, y: 214, w: 110, h: 70, extra: "trois lits" },
  { id: "securite", name: "PC SÉCURITÉ", door: "securite", x: 134, y: 214, w: 114, h: 70, extra: "radio · terminal", terminal: "securite" },
  { id: "labo", name: "LABORATOIRE", door: "labo", x: 20, y: 300, w: 248, h: 76, extra: "terminal · chambre froide", terminal: "labo" },
  { id: "alpha", name: "ALPHA", door: "alpha", x: 0, y: 384, w: 268, h: 62, extra: "accès refusé" },
];

/** The doors drawn in the walls: their centre, and whether the wall is vertical. */
const DOORS: { id: string; cx: number; cy: number; v: boolean }[] = [
  { id: "sas", cx: 188, cy: 54, v: true },
  { id: "dortoir", cx: 270, cy: 150, v: true },
  { id: "beta", cx: 75, cy: 126, v: false },
  { id: "generateurs", cx: 191, cy: 126, v: false },
  { id: "gamma", cx: 75, cy: 214, v: false },
  { id: "securite", cx: 191, cy: 214, v: false },
  { id: "labo", cx: 258, cy: 300, v: false },
  { id: "alpha", cx: 8, cy: 384, v: false },
];

const CORRIDORS: { x: number; y: number; w: number; h: number; label: string; vertical?: boolean; condemned?: boolean }[] = [
  { x: 16, y: 108, w: 252, h: 18, label: "COULOIR" },
  { x: 20, y: 196, w: 248, h: 18, label: "COULOIR" },
  { x: 248, y: 108, w: 20, h: 192, label: "SERVICE", vertical: true },
  { x: 0, y: 108, w: 16, h: 276, label: "CONDAMNÉ", vertical: true, condemned: true },
];

const DORM = { x: 272, y: 0, w: 86, h: 446 };

/** The server's clock as seen from the phone, ticking: for the scenario's loading bar. */
function useServerNow(serverNow: number): number {
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return now + offset;
}

export function useProtocol(view: ConsoleView) {
  const now = useServerNow(view.now);
  const protocol = view.status === "done" ? ("done" as const) : protocolOf(view.state, now);
  const progress = view.state.loadingAt === null ? 0 : Math.min(1, (now - view.state.loadingAt) / LOADING_MS);
  return { protocol, progress };
}

/** What the room sees, in a word, for the header. */
export function screenLabel(view: ConsoleView): string {
  const s = view.state;
  if (s.neutral === "black") return "noir";
  if (s.neutral === "plan") return "plan seul";
  if (s.phase === "welcome") return s.loadingAt !== null ? "chargement" : s.screen === "plan" ? "plan" : "accueil";
  if (s.terminal) return "terminal";
  return momentOf(s).toLowerCase();
}

export function StationFace({ def, view, busy, act, onSheet, sheet }: Props & { onSheet: (s: Sheet) => void; sheet: Sheet }) {
  const s = view.state;
  const reachable = (z: Zone) => (z.door ? !!s.doors[z.door] : s.light);
  const byRoom = new Map(s.players.map((p) => [p.room, p]));
  const rooms = Math.max(20, s.players.length);
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[#1f3a4b] bg-[#0c141b] px-3 text-left text-[0.8rem]" onClick={() => onSheet({ kind: "global" })}>
        <span className="flex flex-wrap gap-x-3 text-[var(--scn-muted)]">
          <span>
            Hall <b className="text-[var(--scn-txt)]">{s.light ? "allumé" : "éteint"}</b>
          </span>
          <span>
            Météo <b className="text-[var(--scn-txt)]">{s.blizzard ? "blizzard" : s.aurora ? "aurore" : "calme"}</b>
          </span>
          {s.dark && <b className="text-[var(--scn-amber)]">délestage</b>}
          {s.ambiances.length > 0 && <span>♪ {s.ambiances.length}</span>}
        </span>
        <span className="font-bold whitespace-nowrap text-[var(--scn-ice)]">Toute la base ›</span>
      </button>

      <div className="relative mx-auto mt-3 w-full max-w-[420px]" style={{ aspectRatio: `${W} / ${H}` }} aria-label="Plan de la base">
        {CORRIDORS.map((c, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute flex items-center justify-center overflow-hidden"
            style={{
              ...box(c.x, c.y, c.w, c.h),
              background: c.condemned ? "repeating-linear-gradient(-45deg, #1a0709 0 5px, #0a0405 5px 10px)" : "#0b141b",
              borderTop: c.condemned ? undefined : "1px dashed #1f3a4b",
              borderBottom: c.condemned ? undefined : "1px dashed #1f3a4b",
            }}
          >
            <span className="text-[0.5rem] font-bold tracking-[0.3em] whitespace-nowrap" style={{ color: c.condemned ? "#8a2a2d" : "#2f4b5d", transform: c.vertical ? "rotate(-90deg)" : undefined }}>
              {c.label}
            </span>
          </div>
        ))}
        {ZONES.map((z) => {
          const alpha = z.id === "alpha";
          const on = reachable(z);
          const selected = sheet?.kind === "zone" && sheet.id === z.id;
          return (
            <button
              key={z.id}
              type="button"
              aria-label={`${z.name}${z.id === "hall" ? (s.light ? ", éclairé" : ", dans le noir") : on ? ", ouvert" : ", fermé"}. Ouvrir la fiche.`}
              onClick={() => onSheet({ kind: "zone", id: z.id })}
              className="absolute flex flex-col items-start justify-between rounded-[3px] p-1.5 text-left"
              style={{
                ...box(z.x, z.y, z.w, z.h),
                border: `2px solid ${selected ? "#7fd8ff" : alpha ? "#6b1f22" : "#3f6f88"}`,
                background: selected ? "#12364a" : alpha ? "repeating-linear-gradient(45deg, #14080a 0 7px, #0c0607 7px 14px)" : on ? "#10202b" : "#070b10",
              }}
            >
              <span className="flex w-full items-center justify-between">
                <span className="text-[0.62rem] font-bold tracking-[0.1em]" style={{ color: alpha ? "#ff6b6b" : on ? "#e6f2fa" : "#8fa6b6" }}>
                  {z.name}
                </span>
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: on && !alpha ? "#ffd76b" : "#1f3a4b" }} />
              </span>
              <span className="text-[0.58rem] text-[#8fa6b6]">{z.extra}</span>
            </button>
          );
        })}
        <div className="absolute rounded border-2 border-[#3f6f88] bg-[#081017]" style={box(DORM.x, DORM.y, DORM.w, DORM.h)}>
          <span className="block px-1 pt-0.5 text-[0.55rem] font-bold tracking-[0.1em] text-[#8fa6b6]">DORTOIR</span>
          <div className="grid grid-cols-2 gap-[3px] p-[3px]" style={{ height: "calc(100% - 1.1rem)", gridTemplateRows: `repeat(${Math.ceil(rooms / 2)}, minmax(0, 1fr))` }}>
            {Array.from({ length: rooms }, (_, i) => i + 1).map((n) => {
              const p = byRoom.get(n);
              const gone = p && p.status !== "alive";
              const selected = sheet?.kind === "room" && sheet.room === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`Chambre ${n}${p ? `, ${p.name}${gone ? (p.status === "dead" ? ", mort" : ", exilé") : ""}` : ", libre"}`}
                  onClick={() => onSheet({ kind: "room", room: n })}
                  className="flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-[3px] px-[1px]"
                  style={{ border: `${selected ? 2 : 1}px solid ${selected ? "#7fd8ff" : s.sealed[n] ? "#6b1f22" : "#1f3a4b"}`, background: selected ? "#12364a" : "#0f1a22", opacity: p || s.sealed[n] ? 1 : 0.55 }}
                >
                  <span className="scn-vt text-[0.95rem] leading-none" style={{ color: gone ? "#ff6b6b" : "#e6f2fa" }}>
                    {String(n).padStart(2, "0")}
                  </span>
                  <span className={`max-w-full truncate text-[0.5rem] font-semibold ${gone ? "text-[#ff6b6b] line-through" : ""}`}>{p?.name ?? (s.sealed[n] ? "scellée" : "")}</span>
                </button>
              );
            })}
          </div>
        </div>
        {DOORS.map((d) => {
          const door = def.doors.find((x) => x.id === d.id);
          if (!door) return null;
          const open = !!s.doors[d.id];
          const alpha = !!door.locked;
          const color = alpha && !open ? "#ff3b3b" : open ? "#7fd8ff" : door.requires ? "#ff6b6b" : "#6f8796";
          const len = d.id === "labo" || alpha ? 16 : 26;
          return (
            <button
              key={d.id}
              type="button"
              aria-label={`Porte ${door.letter} ${door.label} : ${open ? "ouverte" : alpha ? "ne s'ouvre jamais" : "fermée"}. ${alpha && !open ? "Tenter de l'ouvrir." : open ? "Toucher pour fermer." : "Toucher pour ouvrir."}`}
              disabled={busy}
              onClick={() => void act({ t: "door", door: d.id, open: alpha && !open ? false : !open })}
              className="absolute z-[2] h-11 w-11 -translate-x-1/2 -translate-y-1/2 p-0"
              style={{ left: pct(d.cx, W), top: pct(d.cy, H) }}
            >
              <span
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm"
                style={{ width: d.v ? 6 : len, height: d.v ? len : 6, background: color, boxShadow: open ? `0 0 8px ${color}` : undefined }}
              />
              <span className="scn-vt absolute text-[0.95rem] leading-none whitespace-nowrap" style={{ color, ...(d.v ? { left: 26, top: 2 } : { left: 22 + len / 2 + 3, top: 14 }) }}>
                {door.letter}
              </span>
            </button>
          );
        })}
        <span className="scn-vt absolute text-[0.8rem] tracking-[0.1em] text-[#bfeaff]" style={{ left: pct(192, W), top: "-15px" }} aria-hidden>
          ↑ DEHORS
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-[var(--scn-muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-4 bg-[#7fd8ff]" />
          ouverte
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-4 bg-[#6f8796]" />
          fermée
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-4 bg-[#ff6b6b]" />
          verrouillée
        </span>
        <span>· touche une porte pour l&apos;ouvrir, une zone pour sa fiche</span>
      </p>
    </div>
  );
}

// ───────── The sheets ─────────

function Rows({ label, color = "var(--scn-ice)", children }: { label: string; color?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.66rem] font-bold tracking-[0.14em]" style={{ color }}>
        {label}
      </span>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  );
}

export function SheetFrame({ title, sub, color = "var(--scn-ice)", onClose, children }: { title: string; sub?: string; color?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-0 bottom-[4.6rem] z-[60] flex items-end justify-center" onClick={onClose}>
      <section
        role="dialog"
        aria-label={title}
        className="flex max-h-[80%] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-[22px] border-t bg-[#0b1218] px-4 pt-2.5 pb-4 shadow-[0_-18px_40px_rgba(0,0,0,.6)]"
        style={{ borderColor: color }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="h-1 w-10 self-center rounded-sm bg-[#2c4252]" aria-hidden />
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="scn-vt text-3xl leading-none" style={{ color }}>
            {title}
          </h2>
          <button type="button" aria-label="Fermer la fiche" className="h-10 w-10 rounded-[10px] border border-[#2c4252] bg-[#0f1a22] text-lg" onClick={onClose}>
            ×
          </button>
        </div>
        {sub && <p className="-mt-1 text-sm text-[var(--scn-muted)]">{sub}</p>}
        {children}
      </section>
    </div>
  );
}

export function ZoneSheet({ def, view, busy, act, id, onClose }: Props & { id: string; onClose: () => void }) {
  const s = view.state;
  const z = ZONES.find((x) => x.id === id)!;
  const door = z.door ? def.doors.find((d) => d.id === z.door) : null;
  const term = z.terminal ? def.terminals.find((t) => t.id === z.terminal) : null;
  const done = new Set(s.faults.map((f) => f.id));
  const amb = z.ambiance ? def.media.find((m) => m.id === z.ambiance) : null;
  const ambOn = !!amb && s.ambiances.includes(amb.id);
  const live = view.status === "live";
  const flagOk = door?.requires ? s.flags[door.requires] : true;
  return (
    <SheetFrame
      title={`${z.name}${door ? ` · ${door.letter}` : ""}`}
      sub={door?.locked ? "Ne s'ouvre jamais : la base répond « ACCÈS REFUSÉ »." : door?.requires ? `Accès dans le scénario : ${door.hint}${live ? (flagOk ? " (trouvé)" : " (pas encore trouvé)") : ""}.` : door ? "Accès libre." : "Le hall : on l'éclaire, ou pas."}
      onClose={onClose}
    >
      {door && (
        <Rows label="PORTE">
          {door.locked ? (
            <>
              <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "door", door: door.id, open: false })}>
                Tenter d&apos;ouvrir<small>accès refusé</small>
              </button>
              <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "door", door: door.id, open: !s.doors[door.id], force: true })}>
                {s.doors[door.id] ? "Refermer" : "Forcer"}
                <small>{s.doors[door.id] ? "Alpha se referme" : "Alpha s'ouvre"}</small>
              </button>
            </>
          ) : (
            <button type="button" className={`scn-btn ${s.doors[door.id] ? "scn-btn-on" : "scn-btn-primary"}`} disabled={busy} onClick={() => void act({ t: "door", door: door.id, open: !s.doors[door.id] })}>
              {s.doors[door.id] ? "Fermer la porte" : "Ouvrir la porte"}
            </button>
          )}
        </Rows>
      )}
      {z.id === "hall" && (
        <Rows label="ÉCLAIRAGE" color="#ffd76b">
          <button type="button" className={`scn-btn ${s.light ? "scn-btn-on" : "scn-btn-primary"}`} disabled={busy} onClick={() => void act({ t: "light", on: !s.light })}>
            {s.light ? "Éteindre le hall" : "Allumer le hall"}
            <small>{s.light ? "retour au noir" : "néons qui démarrent"}</small>
          </button>
          <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "cut" })}>
            Coupure 4 s<small>générateur qui lâche</small>
          </button>
        </Rows>
      )}
      {term && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">TERMINAL</span>
          <button type="button" className={`scn-btn ${s.terminal === term.id ? "scn-btn-on" : "scn-btn-amber"}`} disabled={busy} onClick={() => void act({ t: "terminal", id: s.terminal === term.id ? null : term.id })}>
            {s.terminal === term.id ? `Fermer le ${term.label.toLowerCase()}` : `Afficher le ${term.label.toLowerCase()}`}
            <small>{s.terminal === term.id ? "retour au plan" : "la caméra zoome sur l'écran"}</small>
          </button>
          {s.terminal === term.id &&
            term.files
              .filter((f) => !f.fault || done.has(f.fault))
              .map((f) => (
                <button key={f.id} type="button" className={`scn-btn text-left ${s.playing === f.id ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "play", file: f.id })}>
                  ▶ {view.setup.files?.[f.id]?.name || f.name}
                  <small>{view.setup.files?.[f.id]?.date || f.meta}</small>
                </button>
              ))}
          {s.terminal === term.id && s.playing && <MediaControls busy={busy} act={act} />}
        </div>
      )}
      {z.id === "beta" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-bad)]">PANIC ROOM · {s.panicReady ? "OPÉRATIONNELLE" : "HORS SERVICE"}</span>
          <button type="button" className={`scn-btn ${s.circuitShown ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "circuit", show: !s.circuitShown })}>
            {s.circuitShown ? "Ranger le boîtier" : "Afficher le boîtier"}
          </button>
          <div className="grid grid-cols-4 gap-1.5">
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
            Solution (pour toi) :{" "}
            <b className="text-[var(--scn-ok)]">
              {view.setup.params.circuit
                .map((up, i) => `${"ABCD"[i]} ${up ? "levé" : "baissé"}`)
                .join(" · ")}
            </b>
          </p>
        </div>
      )}
      {z.id === "generateurs" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">LA JAUGE</span>
          <button type="button" className={`scn-btn ${s.gauge ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "gauge", seconds: s.gauge ? null : view.setup.params.gaugeSeconds })}>
            {s.gauge ? "Arrêter la jauge" : "Lancer la jauge"}
            <small>{Math.round(view.setup.params.gaugeSeconds / 60)} min de carburant</small>
          </button>
          <TimerControls which="gauge" timer={s.gauge} busy={busy} act={act} />
        </div>
      )}
      {amb && (
        <Rows label="AMBIANCE" color="#bfeaff">
          <button type="button" className={`scn-btn ${ambOn ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act(ambOn ? { t: "stopSound", slot: amb.id } : { t: "sound", slot: amb.id })}>
            {ambOn ? "■ " : "▶ "}
            {amb.label}
            <small>en boucle</small>
          </button>
        </Rows>
      )}
      {z.id === "alpha" && <p className="text-xs text-[var(--scn-muted)]">Dans Sang-froid, seule Marga peut forcer le laboratoire ; Alpha reste fermée.</p>}
    </SheetFrame>
  );
}

export function RoomSheet({ view, busy, act, room, onClose }: Props & { room: number; onClose: () => void }) {
  const s = view.state;
  const p = s.players.find((x) => x.room === room);
  const [to, setTo] = useState("");
  const live = view.status === "live";
  return (
    <SheetFrame
      title={`CHAMBRE ${String(room).padStart(2, "0")}`}
      sub={p ? `${p.name} · ${p.status === "alive" ? "sujet actif" : p.status === "dead" ? "mort" : "exilé"}${s.sealed[room] ? ` · scellée (${s.sealed[room]})` : ""}` : s.sealed[room] ? `Scellée : ${s.sealed[room]} y est mort.` : "Chambre libre : les sujets se préparent dans Protocole."}
      onClose={onClose}
    >
      {p && live && (
        <Rows label="SUJET">
          <button type="button" className={`scn-btn ${p.status === "alive" ? "scn-btn-danger" : "scn-btn-on"}`} disabled={busy} onClick={() => void act(p.status === "alive" ? { t: "kill", player: p.id } : { t: "revive", player: p.id })}>
            {p.status === "alive" ? "Noter mort" : "Remettre vivant"}
            <small>correction du meneur</small>
          </button>
        </Rows>
      )}
      {p && view.status !== "done" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-ice)]">CHANGER DE CHAMBRE</span>
          <div className="flex gap-2">
            <select aria-label={`Nouvelle chambre de ${p.name}`} value={to} onChange={(e) => setTo(e.target.value)} className="scn-field flex-1">
              <option value="">Chambre…</option>
              {s.players
                .map((x) => x.room)
                .sort((a, b) => a - b)
                .filter((n) => n !== room)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} · {s.players.find((x) => x.room === n)?.name} (échange)
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="scn-btn px-4"
              disabled={busy || !to}
              onClick={async () => {
                if (!(await act({ t: "room", player: p.id, room: Number(to) }))) onClose();
              }}
            >
              Échanger
            </button>
          </div>
        </div>
      )}
    </SheetFrame>
  );
}

export function GlobalSheet({ def, view, busy, act, onClose }: Props & { onClose: () => void }) {
  const s = view.state;
  const [text, setText] = useState("");
  const categories = [...new Set(def.media.filter((m) => m.category).map((m) => m.category!))];
  return (
    <SheetFrame title="TOUTE LA BASE" sub="Ce qui touche la station entière." onClose={onClose}>
      <Rows label="ÉCLAIRAGE" color="#ffd76b">
        <button type="button" className={`scn-btn ${s.light ? "scn-btn-on" : "scn-btn-primary"}`} disabled={busy} onClick={() => void act({ t: "light", on: !s.light })}>
          {s.light ? "Éteindre le hall" : "Allumer le hall"}
        </button>
        <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "cut" })}>
          Coupure 4 s<small>générateur qui lâche</small>
        </button>
        <button type="button" className={`scn-btn ${s.dark ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "dark", on: !s.dark })}>
          {s.dark ? "Lever le délestage" : "Délestage"}
          <small>{s.dark ? "l'éclairage revient" : "presque noir, une lampe"}</small>
        </button>
      </Rows>
      <Rows label="MÉTÉO ET EFFETS" color="#bfeaff">
        <button type="button" className={`scn-btn ${s.blizzard ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "blizzard", on: !s.blizzard })}>
          Blizzard<small>{s.blizzard ? "en cours : arrêter" : "la neige tombe"}</small>
        </button>
        <button type="button" className={`scn-btn ${s.aurora ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "aurora", on: !s.aurora })}>
          Aurore<small>{s.aurora ? "en cours : arrêter" : "le ciel s'allume"}</small>
        </button>
        <button type="button" className="scn-btn scn-btn-fault" disabled={busy} onClick={() => void act({ t: "glitch" })}>
          Faille<small>la simulation fuit</small>
        </button>
        <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "sound", slot: "son-alarme" })}>
          Alarme<small>une fois</small>
        </button>
      </Rows>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">MINUTEUR</span>
        {s.timer ? (
          <TimerControls which="main" timer={s.timer} busy={busy} act={act} />
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["Débat", 300],
                ["Chrono", 60],
              ] as const
            ).map(([label, seconds]) => (
              <button key={label} type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "timer", which: "main", cmd: "start", seconds, label })}>
                {label} · {seconds / 60} min
              </button>
            ))}
          </div>
        )}
      </div>
      {categories.map((c) => (
        <Rows key={c} label={`SONS · ${c.toUpperCase()}`} color="#bfeaff">
          {def.media
            .filter((m) => m.category === c)
            .map((m) => {
              const on = s.ambiances.includes(m.id);
              return (
                <button key={m.id} type="button" className={`scn-btn ${on ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act(on ? { t: "stopSound", slot: m.id } : { t: "sound", slot: m.id })}>
                  {on ? "■ " : "▶ "}
                  {m.label}
                  {m.loop && <small>{on ? "en boucle : couper" : "en boucle"}</small>}
                </button>
              );
            })}
        </Rows>
      ))}
      <MediaControls busy={busy} act={act} />
      <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "stopSound", slot: null })}>
        Couper tous les sons
      </button>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-magenta)]">INTRUSION</span>
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
      </div>
    </SheetFrame>
  );
}

/** The room's screen: what it shows, and the projection itself (its link, its QR code, its state). */
export function ScreenSheet({ def, view, busy, act, qrSvg, code, onClose }: Props & { qrSvg: string; code: string; onClose: () => void }) {
  const s = view.state;
  const p = view.projection;
  const before = s.phase === "welcome";
  // Inside the side-by-side rehearsal, the link to it is pointless.
  const inFrame = useSyncExternalStore(
    () => () => undefined,
    () => window.self !== window.top,
    () => false,
  );
  const choice = (on: boolean, label: string, sub: string, action: Parameters<Act>[0]) => (
    <button type="button" className={`scn-btn ${on ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act(action)}>
      {label}
      <small>{sub}</small>
    </button>
  );
  return (
    <SheetFrame title="ÉCRAN DE LA SALLE" sub="Ce que montre la projection, quoi qu'il arrive." onClose={onClose}>
      <Rows label="AFFICHER">
        {before ? (
          <>
            {choice(!s.neutral && s.screen === "accueil", "Accueil", "la photo de la station", { t: "screen", mode: "accueil" })}
            {choice(!s.neutral && s.screen === "plan", "Plan", "la base, en direct", { t: "screen", mode: "plan" })}
          </>
        ) : (
          <>
            {choice(!s.neutral, "Le jeu", "ce que la partie montre", { t: "neutral", mode: null })}
            {choice(s.neutral === "plan", "Plan seul", "écran neutre", { t: "neutral", mode: s.neutral === "plan" ? null : "plan" })}
          </>
        )}
        {choice(s.neutral === "black", "Noir", s.neutral === "black" ? "toucher pour revenir" : "écran de secours", { t: "neutral", mode: s.neutral === "black" ? null : "black" })}
      </Rows>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className={`scn-chip ${p.connected ? "scn-chip-ok" : "scn-chip-bad"}`}>{p.connected ? "Projection connectée" : "Projection déconnectée"}</span>
        <span className={`scn-chip ${p.mediaTotal > 0 && p.mediaReady === p.mediaTotal ? "scn-chip-ok" : "scn-chip-warn"}`}>
          Médias {p.mediaReady} / {p.mediaTotal || "?"}
        </span>
        <span className={`scn-chip ${p.mic ? "scn-chip-ok" : ""}`}>{p.mic ? "Micro prêt" : "Pas de micro"}</span>
      </div>
      <p className="text-xs text-[var(--scn-muted)]">Ouvre ce lien sur l&apos;ordinateur branché au vidéoprojecteur : il y choisit son dossier de médias, autorise le micro et passe en plein écran.</p>
      <input readOnly value={view.link} onFocus={(e) => e.target.select()} aria-label="Lien de la projection" className="scn-field text-xs" data-projection-link={view.link} />
      <div className="grid grid-cols-2 gap-1.5">
        <a href={view.link} target="_blank" rel="noopener noreferrer" className="scn-btn flex items-center justify-center">
          Ouvrir la projection ↗
        </a>
        {!inFrame && (
          <a href={`/scenario/${code}/repetition`} className="scn-btn flex flex-col items-center justify-center">
            Vue côte à côte<small>téléphone + écran</small>
          </a>
        )}
      </div>
      <div className="mx-auto w-44 rounded-xl bg-white p-2" aria-label="QR code de la projection" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <details className="text-xs">
        <summary className="cursor-pointer py-2 text-[var(--scn-muted)]">Les fichiers attendus dans le dossier ({def.media.length})</summary>
        <ul className="flex flex-col gap-0.5">
          {def.media.map((m) => (
            <li key={m.id}>
              <code className="text-[var(--scn-amber)]">{m.file}</code> — {m.label}
            </li>
          ))}
        </ul>
      </details>
    </SheetFrame>
  );
}

/** The scenario's strip, under the plan: none loaded, loading, ready to launch, or the game's moment. */
export function ProtocolStrip({ def, view, protocol, progress, onOpen }: { def: PublicScenario; view: ConsoleView; protocol: ReturnType<typeof useProtocol>["protocol"]; progress: number; onOpen: () => void }) {
  const name = (def.short ?? def.title).toUpperCase();
  const [text, action] =
    protocol === "none"
      ? ["Aucun protocole chargé", "Charger"]
      : protocol === "loading"
        ? [`Chargement de ${name}… ${Math.floor(progress * 100)} %`, "Voir"]
        : protocol === "ready"
          ? [`${name} chargé · ${view.setup.players.length} sujets`, "Lancer la partie"]
          : protocol === "done"
            ? [`${name} · partie terminée`, "Voir"]
            : [`${name} · ${momentOf(view.state)}`, "Ouvrir"];
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={onOpen} className="flex min-h-14 w-full items-center justify-between gap-2.5 rounded-[14px] border border-[#5a4316] bg-[#140f05] py-1.5 pr-1.5 pl-3 text-left">
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="text-[0.62rem] font-bold tracking-[0.16em] text-[var(--scn-amber)]">PROTOCOLE</span>
          <span className="max-w-full truncate text-[0.88rem] font-semibold">{text}</span>
        </span>
        <span className="flex-none rounded-[10px] bg-[var(--scn-amber)] px-3 py-2 text-[0.82rem] font-bold text-[#1a1205]">{action}</span>
      </button>
      {protocol === "loading" && (
        <div className="mx-0.5 h-1 rounded-sm bg-[#2a210d]">
          <div className="h-1 rounded-sm bg-[var(--scn-amber)] transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}
