"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LOADING_MS, momentOf, protocolOf } from "@/modules/loups/scenarios/engine";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import type { PublicScenario } from "@/modules/loups/scenarios/types";
import { MediaControls, TimerControls, type Act } from "./controls";
import { SPACES, STATION_DOORS, STATION_H, STATION_W, dormRooms, type SpaceId } from "@/modules/loups/scenarios/station";
import { Furniture } from "../../StationFurniture";
import { RoomContents } from "./Group";
import { DrawPad } from "./DrawPad";

/**
 * The station, on its own: the base's plan, to pilot with a finger, whatever game is played in it
 * (« Antarctica, c'est le contenant »). Touch a door to open it, a zone for its sheet, a room for its
 * subject; « Toute la base » for what touches the whole station. The scenario comes on top (Protocole).
 */

type Props = { def: PublicScenario; view: ConsoleView; busy: boolean; act: Act };
export type Sheet = { kind: "zone"; id: string; space?: SpaceId } | { kind: "room"; room: number } | { kind: "prop"; id: string } | { kind: "global" } | { kind: "screen" } | { kind: "bible" } | null;

interface Zone {
  id: string;
  name: string;
  /** The door that opens it (none: the hall, lit or not). */
  door: string | null;
  extra: string;
  terminal?: string;
  ambiance?: string;
}

const ZONES: Zone[] = [
  { id: "hall", name: "HALL", door: null, extra: "accueil · terminal", terminal: "accueil" },
  { id: "sas", name: "SAS", door: "sas", extra: "hangar", ambiance: "son-vent" },
  { id: "beta", name: "AILE BÊTA", door: "beta", extra: "le couloir, les archives : panic room · terminal", terminal: "beta" },
  { id: "generateurs", name: "GÉNÉRATEURS", door: "generateurs", extra: "la jauge", ambiance: "son-generateurs" },
  { id: "gamma", name: "INFIRMERIE", door: "gamma", extra: "trois lits" },
  { id: "securite", name: "PC SÉCURITÉ", door: "securite", extra: "radio · terminal", terminal: "securite" },
  { id: "labo", name: "LABORATOIRE", door: "labo", extra: "terminal · chambre froide", terminal: "labo" },
  { id: "alpha", name: "ALPHA", door: "alpha", extra: "accès refusé" },
];

/** The dormitory as a zone (its header opens its sheet); its rooms open their subject from the sheet. */
const DORM_ZONE: Zone = { id: "dortoir", name: "DORTOIR", door: "dortoir", extra: "les chambres des sujets" };

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
  if (s.neutral === "black") return "en attente";
  if (s.neutral === "plan") return "plan seul";
  if (s.phase === "welcome") return s.screen === "loading" ? "chargement" : s.screen === "plan" ? "plan" : "accueil";
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


      <svg viewBox="20 18 960 726" className="mx-auto mt-2 w-full max-w-[560px] select-none" role="group" aria-label="Plan de la base">
        <defs>
          <pattern id="ph-red" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill="#0c0607" />
            <rect width="7" height="14" fill="#1a090b" />
          </pattern>
          <pattern id="ph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#0e1a23" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={STATION_W} height={STATION_H} fill="url(#ph-grid)" />
        {SPACES.map((sp) => {
          const z = [...ZONES, DORM_ZONE].find((x) => x.id === sp.zone)!;
          const alpha = sp.id === "alpha";
          const on = reachable(z);
          const selected = sheet?.kind === "zone" && sheet.id === sp.zone;
          const open = () => onSheet({ kind: "zone", id: sp.zone, space: sp.id });
          return (
            <g
              key={sp.id}
              role="button"
              tabIndex={0}
              aria-label={sp.id === "dortoir" ? `DORTOIR, porte ${s.doors.dortoir ? "ouverte" : "fermée"}. Ouvrir la fiche.` : `${sp.name}${sp.id === "hall" ? (s.light ? ", éclairé" : ", dans le noir") : on ? ", ouvert" : ", fermé"}. Ouvrir la fiche.`}
              onClick={open}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open())}
              className="cursor-pointer outline-none"
            >
              <rect x={sp.x} y={sp.y} width={sp.w} height={sp.h} fill={alpha ? "url(#ph-red)" : selected ? "#12364a" : on ? "#10202b" : "#070b10"} stroke={selected ? "#7fd8ff" : alpha ? "#6b1f22" : "#3f6f88"} strokeWidth={selected ? 7 : 5} />
              <g fill="#1d3444" stroke="#3a6378" strokeWidth={1.5} opacity={on || alpha ? 1 : 0.5}>
                <Furniture id={sp.id} />
              </g>
              {sp.id === "dortoir" &&
                dormRooms(rooms).map(({ n, x, y, w, h }) => {
                  const p = byRoom.get(n);
                  const gone = p && p.status !== "alive";
                  return (
                    <g key={n}>
                      <rect x={x} y={y} width={w} height={h} rx={2} fill={s.sealed[n] ? "#1a0709" : "#0a1720"} stroke={s.sealed[n] ? "#6b1f22" : "#24394a"} />
                      <text x={x + 8} y={y + h * 0.72} fontSize={Math.min(20, h * 0.75)} fill={gone ? "#ff6b6b" : "#8fa6b6"} className="scn-vt">
                        {String(n).padStart(2, "0")}
                      </text>
                      <text x={x + 36} y={y + h * 0.72} fontSize={Math.min(17, h * 0.62)} fill={gone ? "#ff6b6b" : "#e6f2fa"}>
                        {(p?.name ?? (s.sealed[n] ? "scellée" : "")).slice(0, 12)}
                      </text>
                      {gone && (
                        <g stroke="#d0181c" strokeWidth={2.5}>
                          <line x1={x + 2} y1={y + 2} x2={x + w - 2} y2={y + h - 2} />
                          <line x1={x + w - 2} y1={y + 2} x2={x + 2} y2={y + h - 2} />
                        </g>
                      )}
                    </g>
                  );
                })}
              {sp.id === "couloir" ? (
                <text x={sp.x + 24} y={sp.y + sp.h / 2} textAnchor="middle" transform={`rotate(-90 ${sp.x + 24} ${sp.y + sp.h / 2})`} fontSize={24} letterSpacing={3} fontWeight={700} fill={on ? "#e6f2fa" : "#8fa6b6"}>
                  {sp.name}
                </text>
              ) : (
                <text x={sp.x + 10} y={sp.y + 30} fontSize={sp.w <= 120 ? 17 : 26} letterSpacing={sp.w <= 120 ? 0 : 2} fontWeight={700} fill={alpha ? "#ff6b6b" : on ? "#e6f2fa" : "#8fa6b6"}>
                  {sp.name}
                </text>
              )}
              {!alpha && sp.id !== "couloir" && <circle cx={sp.x + sp.w - 14} cy={sp.y + 20} r={7} fill={on ? "#ffd76b" : "#1f3a4b"} />}
            </g>
          );
        })}
        {STATION_DOORS.map((d) => {
          const door = def.doors.find((x) => x.id === (d.follows ?? d.id));
          if (!door) return null;
          const open = !!s.doors[door.id];
          const alpha = !!door.locked;
          const color = alpha && !open ? "#ff3b3b" : open ? "#7fd8ff" : door.requires ? "#ff6b6b" : "#9fb3c2";
          const len = 44;
          const left = d.v && d.side === "l";
          const lx = d.v ? (left ? d.x - 12 : d.x + 12) : d.x + len / 2 + 8;
          const ly = d.v ? d.y + 8 : d.y + 10;
          const bar = d.v ? <rect x={d.x - 5} y={d.y - len / 2} width={10} height={len} rx={2} fill={color} /> : <rect x={d.x - len / 2} y={d.y - 5} width={len} height={10} rx={2} fill={color} />;
          const letter = (
            <text x={lx} y={ly} textAnchor={left ? "end" : "start"} fontSize={30} fill={color} className="scn-vt">
              {d.letter}
            </text>
          );
          // The archives open with the Bêta wing: drawn, not touched.
          if (d.follows)
            return (
              <g key={d.id} aria-hidden>
                {bar}
                {letter}
              </g>
            );
          const toggle = () => void act({ t: "door", door: door.id, open: alpha && !open ? false : !open });
          return (
            <g
              key={d.id}
              role="button"
              tabIndex={0}
              aria-label={`Porte ${door.letter} ${door.label} : ${open ? "ouverte" : alpha ? "ne s'ouvre jamais" : "fermée"}. ${alpha && !open ? "Tenter de l'ouvrir." : open ? "Toucher pour fermer." : "Toucher pour ouvrir."}`}
              aria-disabled={busy}
              onClick={() => !busy && toggle()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && (e.preventDefault(), toggle())}
              className="cursor-pointer outline-none"
            >
              <rect x={d.x - 42} y={d.y - 42} width={84} height={84} fill="transparent" />
              {bar}
              {open && <rect x={d.v ? d.x - 9 : d.x - len / 2 - 4} y={d.v ? d.y - len / 2 - 4 : d.y - 9} width={d.v ? 18 : len + 8} height={d.v ? len + 8 : 18} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />}
              {letter}
            </g>
          );
        })}
        <text x={500} y={740} textAnchor="middle" fontSize={20} letterSpacing={3} fill="#5d7a8c" className="scn-vt">
          ↓ DEHORS · −45 °C
        </text>
        {/* The group: a pulsing amber mark in its space. */}
        {(() => {
          const at = SPACES.find((x) => x.id === s.at)!;
          const gx = at.id === "couloir" ? at.x + at.w / 2 + 16 : at.x + at.w / 2;
          const gy = at.y + at.h / 2 + (at.id === "hall" ? 30 : 0);
          return (
            <g aria-hidden pointerEvents="none">
              <circle cx={gx} cy={gy} r={18} fill="none" stroke="#ffb23e" strokeWidth={4} className="animate-ping" style={{ transformOrigin: `${gx}px ${gy}px` }} />
              <circle cx={gx} cy={gy} r={11} fill="#ffb23e" />
            </g>
          );
        })()}
      </svg>
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

export function ZoneSheet({ def, view, busy, act, id, space, onClose, onRoom, onProp }: Props & { id: string; space?: SpaceId; onClose: () => void; onRoom: (room: number) => void; onProp: (id: string) => void }) {
  const s = view.state;
  const z = [...ZONES, DORM_ZONE].find((x) => x.id === id)!;
  const door = z.door ? def.doors.find((d) => d.id === z.door) : null;
  const term = z.terminal ? def.terminals.find((t) => t.id === z.terminal) : null;
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
      {term && <TerminalBlock def={def} view={view} busy={busy} act={act} id={term.id} />}
      {(() => {
        // The room touched on the plan (the Bêta wing is two: its corridor and the archives).
        const room: SpaceId = space ?? (SPACES.find((x) => x.zone === z.id)?.id ?? "hall");
        return <RoomContents def={def} view={view} busy={busy} act={act} space={room} onProp={onProp} />;
      })()}
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
      {z.id === "generateurs" && <GaugeBlock view={view} busy={busy} act={act} />}
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
      {z.id === "dortoir" && (
        <p className="text-sm text-[var(--scn-muted)]">
          {s.players.length
            ? `${s.players.length} sujets, ${s.players.filter((p) => p.status === "alive").length} actifs${Object.keys(s.sealed).length ? `, ${Object.keys(s.sealed).length} chambres scellées` : ""}.`
            : "Pas encore de sujets : ils se préparent dans Protocole."}{" "}
          Touche une chambre pour la fiche de son sujet.
        </p>
      )}
      {z.id === "dortoir" && (
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: Math.max(20, s.players.length) }, (_, i) => i + 1).map((n) => {
            const p = s.players.find((x) => x.room === n);
            const gone = p && p.status !== "alive";
            return (
              <button
                key={n}
                type="button"
                aria-label={`Chambre ${n}${p ? `, ${p.name}${gone ? (p.status === "dead" ? ", mort" : ", exilé") : ""}` : ", libre"}`}
                onClick={() => onRoom(n)}
                className="relative flex min-h-12 flex-col items-center justify-center overflow-hidden rounded-lg border px-1"
                style={{ borderColor: gone || s.sealed[n] ? "#6b1f22" : "#1f3a4b", background: gone ? "#1a0709" : "#0f1a22", opacity: p || s.sealed[n] ? 1 : 0.55 }}
              >
                {gone && (
                  <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 10 10">
                    <path d="M0 0L10 10M10 0L0 10" stroke="#d0181c" strokeWidth="0.6" />
                  </svg>
                )}
                <span className="scn-vt text-lg leading-none" style={{ color: gone ? "#ff6b6b" : "#e6f2fa" }}>
                  {String(n).padStart(2, "0")}
                </span>
                <span className={`max-w-full truncate text-[0.62rem] font-semibold ${gone ? "text-[#ff6b6b] line-through" : ""}`}>{p?.name ?? (s.sealed[n] ? "scellée" : "")}</span>
              </button>
            );
          })}
        </div>
      )}
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
            {p.status === "alive" ? "Tuer" : "Remettre vivant"}
            <small>{p.status === "alive" ? "une croix rouge sur sa chambre" : "correction du meneur"}</small>
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
  return (
    <SheetFrame title="TOUTE LA BASE" sub="Tout ce que la station sait faire, au même endroit partout. Chaque chose s'allume et s'éteint." onClose={onClose}>
      <BaseControls def={def} view={view} busy={busy} act={act} />
    </SheetFrame>
  );
}

/**
 * Everything the base does, in one order everywhere: the environment first (light, weather and effects,
 * sounds, intrusion: what Rémi plays), then what the story uses (the room's recording, the terminals,
 * the scenario's faults, the timers).
 */
export function BaseControls({ def, view, busy, act }: Props) {
  const loaded = view.state.loadingAt !== null || view.status !== "setup";
  return (
    <>
      <LightRows view={view} busy={busy} act={act} />
      <EffectRows view={view} busy={busy} act={act} />
      <SoundRows def={def} view={view} busy={busy} act={act} />
      <CutSounds busy={busy} act={act} />
      <IntrusionBlock view={view} busy={busy} act={act} />
      <RecordBlock view={view} busy={busy} act={act} />
      <div className="flex flex-col gap-2">
        <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">TERMINAUX</span>
        {def.terminals.map((t) => (
          <TerminalBlock key={t.id} def={def} view={view} busy={busy} act={act} id={t.id} bare />
        ))}
      </div>
      {loaded && <FaultRows def={def} view={view} busy={busy} act={act} />}
      <TimerBlock view={view} busy={busy} act={act} />
      <GaugeBlock view={view} busy={busy} act={act} />
    </>
  );
}

/** A terminal: shown or closed with one gesture, its password if it has one, its files, the player. */
export function TerminalBlock({ def, view, busy, act, id, bare = false }: Props & { id: string; bare?: boolean }) {
  const s = view.state;
  const term = def.terminals.find((t) => t.id === id);
  if (!term) return null;
  const open = s.terminal === term.id;
  const locked = !!def.sandbox?.passwords[term.id] && !s.unlocked.includes(term.id);
  return (
    <div className="flex flex-col gap-1.5">
      {!bare && <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">TERMINAL</span>}
      <button type="button" aria-pressed={open} className={`scn-btn ${open ? "scn-btn-on" : "scn-btn-amber"}`} disabled={busy} onClick={() => void act({ t: "terminal", id: open ? null : term.id })}>
        {open ? `Fermer le ${term.label.toLowerCase()}` : `Afficher le ${term.label.toLowerCase()}`}
        <small>{open ? "retour au plan" : `la caméra zoome sur l'écran${locked ? " · mot de passe" : ""}`}</small>
      </button>
      {open && locked && <PasswordBlock def={def} view={view} busy={busy} act={act} terminal={term.id} />}
      {open &&
        !locked &&
        term.files
          .filter((f) => !f.fault || s.faultsOn.includes(f.fault))
          .map((f) => (
            <button key={f.id} type="button" className={`scn-btn text-left ${s.playing === f.id ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "play", file: f.id })}>
              ▶ {view.setup.files?.[f.id]?.name || f.name}
              <small>{view.setup.files?.[f.id]?.date || f.meta}</small>
            </button>
          ))}
      {open && s.playing && <MediaControls busy={busy} act={act} />}
    </div>
  );
}

/** The scenario's faults, switched on and off like a sound; which ones may go off this evening, folded. */
export function FaultRows({ def, view, busy, act }: Props) {
  const s = view.state;
  const all = [...def.faults, ...view.setup.extraFaults];
  const off = new Set(s.faultsOff);
  const on = new Set(s.faultsOn);
  const allOn = all.every((f) => !off.has(f.id));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-magenta)]">
        FAILLES DU SCÉNARIO{on.size ? ` · ${on.size} à l'écran` : ""}
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {all
          .slice()
          .sort((a, b) => Number(!a.loops.includes(s.loop)) - Number(!b.loops.includes(s.loop)))
          .map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={on.has(f.id)}
              className={`scn-btn text-left ${on.has(f.id) ? "scn-btn-on" : f.loops.includes(s.loop) ? "scn-btn-fault" : ""}`}
              disabled={busy || off.has(f.id)}
              onClick={() => void act({ t: "fault", id: f.id, on: !on.has(f.id) })}
            >
              {on.has(f.id) ? "■ " : "▶ "}
              {f.title}
              <small>
                {off.has(f.id) ? "désactivée pour la soirée" : on.has(f.id) ? "à l'écran : toucher pour la retirer" : `boucle ${f.loops.join(" et ")}`}
                {f.kind === "terminalFile" && f.id === "hallmic" && !on.has(f.id) ? (view.projection.mic ? " · l'enregistrement de la salle" : " · le fichier de secours") : ""}
              </small>
            </button>
          ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer py-2 text-[var(--scn-muted)]">Failles autorisées ce soir…</summary>
        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>Toutes les failles</span>
            <input type="checkbox" checked={allOn} disabled={busy} onChange={(e) => void act({ t: "faultToggle", id: null, on: e.target.checked })} className="h-6 w-6" />
          </label>
          {all.map((f) => (
            <label key={f.id} className="flex min-h-10 items-center justify-between gap-3 text-[var(--scn-muted)]">
              <span>{f.title}</span>
              <input type="checkbox" aria-label={`${f.title} : autorisée`} checked={!off.has(f.id)} disabled={busy} onChange={(e) => void act({ t: "faultToggle", id: f.id, on: e.target.checked })} className="h-6 w-6" />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

/** The evening's timer: the debate, a minute's chrono; paused, lengthened, stopped. */
export function TimerBlock({ view, busy, act }: Env) {
  const s = view.state;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">MINUTEUR{s.timer ? ` · ${s.timer.label || "en cours"}` : ""}</span>
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
  );
}

/** The generators' fuel: started, stopped, paused. */
export function GaugeBlock({ view, busy, act }: Env) {
  const s = view.state;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">LA JAUGE DES GÉNÉRATEURS</span>
      <button type="button" aria-pressed={!!s.gauge} className={`scn-btn ${s.gauge ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "gauge", seconds: s.gauge ? null : view.setup.params.gaugeSeconds })}>
        {s.gauge ? "Arrêter la jauge" : "Lancer la jauge"}
        <small>{Math.round(view.setup.params.gaugeSeconds / 60)} min de carburant</small>
      </button>
      <TimerControls which="gauge" timer={s.gauge} busy={busy} act={act} />
    </div>
  );
}

/** Thirty seconds of the room, by the projection computer's microphone: the file then waits on a terminal. */
export function RecordBlock({ view, busy, act }: Env) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">LA SALLE</span>
      <button type="button" className="scn-btn" disabled={busy || !view.projection.mic} onClick={() => void act({ t: "record" })}>
        🎙️ Enregistrer la salle 30 s<small>{view.projection.mic ? "par le micro de l'ordinateur de projection" : "micro non autorisé sur la projection"}</small>
      </button>
    </div>
  );
}

type Env = { view: ConsoleView; busy: boolean; act: Act };

/** The hall's light, the generator that gives way, the load shedding. */
export function LightRows({ view, busy, act }: Env) {
  const s = view.state;
  return (
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
  );
}

/** The weather and the simulation's leaks. */
export function EffectRows({ view, busy, act }: Env) {
  const s = view.state;
  return (
    <Rows label="MÉTÉO ET EFFETS" color="#bfeaff">
      <button type="button" className={`scn-btn ${s.blizzard ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "blizzard", on: !s.blizzard })}>
        Blizzard<small>{s.blizzard ? "en cours : arrêter" : "la neige tombe"}</small>
      </button>
      <button type="button" className={`scn-btn ${s.aurora ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "aurora", on: !s.aurora })}>
        Aurore<small>{s.aurora ? "en cours : arrêter" : "le ciel s'allume"}</small>
      </button>
      <button type="button" className="scn-btn scn-btn-fault" disabled={busy} onClick={() => void act({ t: "glitch" })}>
        Glitch<small>l&apos;image saute, une fois</small>
      </button>
      <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "sound", slot: "son-alarme" })}>
        Alarme<small>une fois</small>
      </button>
    </Rows>
  );
}

/** Every sound of the base, by family: a loop is switched on and off, a sound plays once. */
export function SoundRows({ def, view, busy, act }: Env & { def: PublicScenario }) {
  const s = view.state;
  const categories = [...new Set(def.media.filter((m) => m.category).map((m) => m.category!))];
  return (
    <>
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
    </>
  );
}

export function CutSounds({ busy, act }: { busy: boolean; act: Act }) {
  return (
    <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={() => void act({ t: "stopSound", slot: null })}>
      Couper tous les sons
    </button>
  );
}

/** Marga writes on the room's screen, or draws on it. */
export function IntrusionBlock({ view, busy, act }: Env) {
  const s = view.state;
  const [text, setText] = useState("");
  return (
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
      <details className="mt-1">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-[var(--scn-magenta)]">✎ Intrusion dessinée{s.drawing ? " · à l'écran" : ""}</summary>
        <DrawPad busy={busy} act={act} shown={!!s.drawing} />
      </details>
    </div>
  );
}

/** What the room's screen shows: before the game, the welcome or the plan; during it, the game or a neutral screen. */
export function ScreenChoices({ view, busy, act }: Env) {
  const s = view.state;
  const before = s.phase === "welcome";
  const choice = (on: boolean, label: string, sub: string, action: Parameters<Act>[0]) => (
    <button type="button" className={`scn-btn ${on ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act(action)}>
      {label}
      <small>{sub}</small>
    </button>
  );
  return (
    <Rows label="AFFICHER">
      {before ? (
        <>
          {choice(!s.neutral && s.screen === "accueil", "Accueil", "la photo de la station", { t: "screen", mode: "accueil" })}
          {choice(!s.neutral && s.screen === "plan", "Plan", "la base, en direct", { t: "screen", mode: "plan" })}
          {view.state.loadingAt !== null && choice(!s.neutral && s.screen === "loading", "Chargement", "« chargement du scénario » : à montrer seulement si tu le veux", { t: "screen", mode: "loading" })}
        </>
      ) : (
        <>
          {choice(!s.neutral, "Le jeu", "ce que la partie montre", { t: "neutral", mode: null })}
          {choice(s.neutral === "plan", "Plan seul", "écran neutre", { t: "neutral", mode: s.neutral === "plan" ? null : "plan" })}
        </>
      )}
      {choice(s.neutral === "black", "En attente", s.neutral === "black" ? "toucher pour revenir" : "« en attente de connexion »", { t: "neutral", mode: s.neutral === "black" ? null : "black" })}
    </Rows>
  );
}

/** The room's screen: what it shows, and the projection itself (its link, its QR code, its state). */
export function ScreenSheet({ view, busy, act, qrSvg, onClose, onBible }: Props & { qrSvg: string; code: string; onClose: () => void; onBible: () => void }) {
  const s = view.state;
  const [resetAsked, setResetAsked] = useState(false);
  const p = view.projection;
  return (
    <SheetFrame title="ÉCRAN DE LA SALLE" sub="Ce que montre la projection, quoi qu'il arrive." onClose={onClose}>
      <ScreenChoices view={view} busy={busy} act={act} />
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className={`scn-chip ${p.connected ? "scn-chip-ok" : "scn-chip-bad"}`}>{p.connected ? "Projection connectée" : "Projection déconnectée"}</span>
        <span className={`scn-chip ${p.mediaTotal > 0 && p.mediaReady === p.mediaTotal ? "scn-chip-ok" : "scn-chip-warn"}`}>
          Médias {p.mediaReady} / {p.mediaTotal || "?"}
        </span>
        <span className={`scn-chip ${p.mic ? "scn-chip-ok" : ""}`}>{p.mic ? "Micro prêt" : "Pas de micro"}</span>
      </div>
      <button type="button" aria-pressed={s.overview} className={`scn-btn ${s.overview ? "scn-btn-on" : ""}`} disabled={busy} onClick={() => void act({ t: "overview", on: !s.overview })}>
        {s.overview ? "Vue globale de la base" : "Vue qui suit le groupe"}
        <small>{s.overview ? "la salle voit toute la base · toucher pour suivre le groupe" : "la salle voit ce qui est connu · toucher pour toute la base"}</small>
      </button>
      <button type="button" className="scn-btn" onClick={onBible}>
        📖 La bible de la base
        <small>tout ce qui existe : pièces, portes, meubles, cachettes, objets, terminaux, sons, effets</small>
      </button>
      {s.phase === "welcome" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">REDÉMARRAGE</span>
          {resetAsked ? (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                className="scn-btn scn-btn-danger"
                disabled={busy}
                onClick={async () => {
                  setResetAsked(false);
                  await act({ t: "reset" });
                }}
              >
                Redémarrer
                <small>portes, lumière, sons : tout revient</small>
              </button>
              <button type="button" className="scn-btn" onClick={() => setResetAsked(false)}>
                Garder la station
                <small>ne rien changer</small>
              </button>
            </div>
          ) : (
            <button type="button" className="scn-btn" disabled={busy} onClick={() => setResetAsked(true)}>
              Redémarrer la station
              <small>tout comme au départ ; les joueurs restent</small>
            </button>
          )}
        </div>
      )}
      {/* Opening the projection, the side-by-side view and the expected files live on the CLHUB's scenarios page,
          before choosing phone or projection. Here, only a QR code, folded, for another device in a pinch. */}
      <details className="text-xs">
        <summary className="cursor-pointer py-2 text-[var(--scn-muted)]">QR code de la projection (autre appareil)</summary>
        <div className="mx-auto mt-1 w-44 rounded-xl bg-white p-2" aria-label="QR code de la projection" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <input readOnly value={view.link} onFocus={(e) => e.target.select()} aria-label="Lien de la projection" className="scn-field mt-2 w-full text-xs" />
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

/**
 * A terminal behind its password (the archives', V1.4 §3): the players dictate, the meneur types, the room
 * sees the letters. The three aids, by hand only, in order: the briefing's line (a reminder for the
 * meneur), then Marga's intrusions.
 */
function PasswordBlock({ def, view, busy, act, terminal }: Props & { terminal: string }) {
  const s = view.state;
  const lock = def.sandbox!.passwords[terminal]!;
  const [typed, setTyped] = useState("");
  const [aid, setAid] = useState(0);
  const aids = lock.aids ?? [];
  // « Intrusion de Marga : « L _ _ _ A » » → the words between the last quotes.
  const intrusionOf = (line: string) => line.match(/«\s*([^«»]+?)\s*»\s*$/)?.[1] ?? null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--scn-amber)] p-2">
      <span className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-amber)]">VERROUILLÉ · MOT DE PASSE DICTÉ PAR LES JOUEURS</span>
      <form
        className="flex gap-1.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!typed.trim()) return;
          if (!(await act({ t: "password", prop: terminal, text: typed }))) setTyped("");
        }}
      >
        <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} maxLength={24} autoComplete="off" aria-label="Mot de passe dicté par les joueurs" placeholder="tape ici" className="scn-field min-w-0 flex-1" />
        <button type="submit" className="scn-btn scn-btn-primary" disabled={busy || !typed.trim()}>
          Taper
        </button>
      </form>
      <p className="text-xs text-[var(--scn-muted)]">
        Le bon, pour toi : <b className="text-[#ffcf7a]">{lock.word}</b>
        {s.pwTries ? ` · ${s.pwTries} essai${s.pwTries > 1 ? "s" : ""} raté${s.pwTries > 1 ? "s" : ""}` : ""}
      </p>
      {aids.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[0.62rem] font-bold tracking-[0.14em] text-[var(--scn-muted)]">AIDES, DANS L&apos;ORDRE, SEULEMENT SI ÇA BLOQUE</span>
          {aids.map((line, i) => {
            const words = intrusionOf(line);
            return (
              <button
                key={i}
                type="button"
                className={`scn-btn text-left ${i < aid ? "scn-btn-on" : ""} ${words ? "scn-btn-fault" : ""}`}
                disabled={busy || i > aid}
                onClick={async () => {
                  // An intrusion aid on screen: touching it again takes it away.
                  if (words) await act({ t: "intrusion", text: s.intrusion === words ? null : words });
                  setAid(Math.max(aid, i + 1));
                }}
              >
                {i + 1}. {line}
                {!words ? <small>à dire à voix haute ; rien à l&apos;écran</small> : s.intrusion === words ? <small>à l&apos;écran · toucher pour la retirer</small> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
