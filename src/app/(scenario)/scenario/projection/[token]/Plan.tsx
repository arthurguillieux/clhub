import type { CSSProperties } from "react";
import { SPACES, SPOTS, STATION_DOORS, STATION_H, STATION_W, dormRooms, spaceShown, type Space, type SpaceId, type StationDoor } from "@/modules/loups/scenarios/station";
import { Furniture } from "../../StationFurniture";

/**
 * The room's plan of the station (modules/loups/scenarios/station.ts): the same base whatever the
 * scenario, drawn as on the sandbox mockup — the hall and its three doors (dormitory, Bêta, Alpha), the
 * Bêta wing behind. Each space shows with a sweep once it's reached; the dormitory remembers the dead of
 * earlier loops; Alpha stays a red silhouette.
 */
export function Plan({
  players,
  sealed,
  light,
  doors,
  panicReady,
  hot,
  denied,
  parity = false,
  confinement = false,
  at = null,
  overview = true,
}: {
  players: { id: string; name: string; room: number; status: "alive" | "dead" | "exiled" }[];
  sealed: Record<number, string>;
  light: boolean;
  doors: Record<string, boolean>;
  panicReady: boolean;
  /** The terminals that can be used now, by the room the scenario puts them in. */
  hot: Record<string, boolean>;
  denied: boolean;
  /** Tour de garde, Confinement: the even rooms lit. */
  parity?: boolean;
  /** The base cut in two by a fire door. */
  confinement?: boolean;
  /** Where the group is (a pulsing mark), and whether the room sees the whole base or follows the group. */
  at?: SpaceId | null;
  overview?: boolean;
}) {
  const shown = (s: Space) => spaceShown(s.id, light, doors);
  const rooms = dormRooms(Math.max(players.length, 20));
  // Following the group: the frame closes on what's known (and where they are), in the plan's proportions.
  const frame = (() => {
    if (overview || !at) return "none";
    const known = SPACES.filter((s) => s.id !== "alpha" && (shown(s) || s.id === at));
    if (!known.length) return "none";
    const x0 = Math.min(...known.map((k) => k.x)) - 70;
    const y0 = Math.min(...known.map((k) => k.y)) - 70;
    const x1 = Math.max(...known.map((k) => k.x + k.w)) + 70;
    const y1 = Math.max(...known.map((k) => k.y + k.h)) + 50;
    const scale = Math.min(2.2, STATION_W / Math.max(1, x1 - x0), STATION_H / Math.max(1, y1 - y0));
    if (scale <= 1.02) return "none";
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return `translate(${STATION_W / 2 - cx * scale}px, ${STATION_H / 2 - cy * scale}px) scale(${scale})`;
  })();
  const atSpace = at ? SPACES.find((s) => s.id === at) : null;

  return (
    <svg viewBox={`0 0 ${STATION_W} ${STATION_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plan de la base">
      <defs>
        <pattern id="pj-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#0d2230" strokeWidth="1" />
        </pattern>
        <pattern id="pj-hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="16" stroke="#5a1416" strokeWidth="2" />
        </pattern>
        <linearGradient id="pj-scangrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd8ff" stopOpacity="0" />
          <stop offset=".85" stopColor="#7fd8ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#e8f8ff" stopOpacity=".9" />
        </linearGradient>
        <filter id="pj-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pj-rough">
          <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="7" />
        </filter>
      </defs>
      <rect x="-200" y="-200" width={STATION_W + 400} height={STATION_H + 400} fill="url(#pj-grid)" />
      <g style={{ transform: frame, transformOrigin: "0 0", transition: "transform 1.1s cubic-bezier(.6,0,.2,1)" }}>
      <text x="500" y="752" textAnchor="middle" className="sublabel" style={{ fontSize: 18 }}>
        ↓ DEHORS · −45 °C
      </text>

      <g filter="url(#pj-glow)">
        {SPACES.filter((s) => s.id !== "alpha").map((s) => (
          <g key={s.id} className={`room ${shown(s) ? "revealed" : "unknown"}`}>
            <rect className="wall" x={s.x} y={s.y} width={s.w} height={s.h} />
            {s.w > 110 && s.h > 100 && (
              <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 8} textAnchor="middle" className="qm unk" style={{ fontSize: 18 }}>
                NON CARTOGRAPHIÉ
              </text>
            )}
            <g className="content">
              <g className="furn">
                <Furniture id={s.id} />
              </g>
              {s.id === "couloir" ? (
                <text x={s.x + 24} y={s.y + s.h / 2} textAnchor="middle" className="label" style={{ fontSize: 22 }} transform={`rotate(-90 ${s.x + 24} ${s.y + s.h / 2})`}>
                  {s.name}
                </text>
              ) : (
                <text x={s.x + 10} y={s.y + 26} className="label" style={{ fontSize: s.w <= 120 ? 16 : 24, letterSpacing: s.w <= 120 ? 1 : undefined }}>
                  {s.name}
                </text>
              )}
              {s.id === "dortoir" && <Dorm rooms={rooms} players={players} sealed={sealed} parity={parity} />}
              {s.id === "hall" && (
                <g filter="url(#pj-rough)">
                  <path className="blood hi" d="M478 628 c3 -11 -2 -20 5 -31 c3 -6 2 -15 -3 -18 c-5 6 -5 15 -8 23 c-5 9 -3 20 6 26z" />
                  <path className="blood" d="M500 626 c8 -8 5 -23 9 -35 3 -8 11 -17 5 -23 -8 -5 -12 6 -14 14 -2 11 -6 18 -5 31 1 6 2 11 5 13z" />
                </g>
              )}
              {s.id === "archives" && (
                <g className={`panic ${panicReady ? "ok" : ""}`}>
                  <rect className="pbox" x={374} y={226} width={62} height={48} />
                  <text x={405} y={245} textAnchor="middle" className="ptxt" style={{ fontSize: 11 }}>
                    PANIC
                  </text>
                  <text x={405} y={258} textAnchor="middle" className="ptxt" style={{ fontSize: 11 }}>
                    ROOM
                  </text>
                  <text x={405} y={270} textAnchor="middle" className="ptxt" style={{ fontSize: 9 }}>
                    {panicReady ? "OK" : "HS"}
                  </text>
                </g>
              )}
              {s.id === "hall" && <circle className={`hot ${hot.hall ? "live" : ""}`} cx={SPOTS.hall!.x} cy={SPOTS.hall!.y} r={16} />}
              {s.id === "archives" && <circle className={`hot ${hot.beta ? "live" : ""}`} cx={SPOTS.beta!.x} cy={SPOTS.beta!.y} r={16} />}
              {s.id === "securite" && <circle className={`hot ${hot.securite ? "live" : ""}`} cx={SPOTS.securite!.x} cy={SPOTS.securite!.y} r={16} />}
              {s.id === "labo" && <circle className={`hot ${hot.labo ? "live" : ""}`} cx={SPOTS.labo!.x} cy={SPOTS.labo!.y} r={16} />}
            </g>
            <Scan x={s.x} y={s.y} w={s.w} h={s.h} />
          </g>
        ))}

        {/* ── Α Alpha: always a red silhouette ── */}
        <g className="room unknown">
          <rect className="wall" x={660} y={380} width={300} height={340} style={{ stroke: "#9b0f12" }} />
          <rect x={660} y={380} width={300} height={340} fill="url(#pj-hatch)" opacity=".35" />
          <text x={676} y={410} className="label" style={{ fill: "#d0181c", fontSize: 24 }}>
            Α ALPHA
          </text>
          <text x={810} y={560} textAnchor="middle" className="qm" style={{ fill: "#d0181c", fontSize: 60 }}>
            ?
          </text>
          <text x={810} y={600} textAnchor="middle" className="sublabel" style={{ fill: "#ff6b6b", fontSize: 16 }}>
            ACCÈS RESTREINT
          </text>
        </g>
      </g>

      {confinement && (
        <g>
          <line x1={190} y1={336} x2={190} y2={716} stroke="#ff4d4d" strokeWidth="5" strokeDasharray="18 8" />
          <text x={120} y={352} textAnchor="middle" className="sublabel" style={{ fill: "#ffb23e", fontSize: 14 }}>
            IMPAIRES
          </text>
          <text x={262} y={352} textAnchor="middle" className="sublabel" style={{ fill: "#7fd8ff", fontSize: 14 }}>
            PAIRES
          </text>
          <text x={190} y={736} textAnchor="middle" className="sublabel" style={{ fill: "#ff4d4d", fontSize: 16 }}>
            PORTE COUPE-FEU
          </text>
        </g>
      )}

      {STATION_DOORS.map((d) => (
        <Door key={d.id} d={d} open={d.id === "alpha" ? false : !!doors[d.follows ?? d.id]} denied={d.id === "alpha" && denied} blood={d.id === "alpha"} />
      ))}
      {atSpace && (
        <g aria-hidden>
          <circle className="pj-group" cx={atSpace.x + atSpace.w / 2 + (atSpace.id === "couloir" ? 16 : 0)} cy={atSpace.y + atSpace.h / 2 + (atSpace.id === "hall" ? 30 : 0)} r={15} fill="none" stroke="#ffb23e" strokeWidth={3} />
          <circle cx={atSpace.x + atSpace.w / 2 + (atSpace.id === "couloir" ? 16 : 0)} cy={atSpace.y + atSpace.h / 2 + (atSpace.id === "hall" ? 30 : 0)} r={9} fill="#ffb23e" />
        </g>
      )}
      </g>
    </svg>
  );
}

/** The dormitory's rooms: the number, the dead of earlier loops, the sealed rooms with their name. */
function Dorm({ rooms, players, sealed, parity }: { rooms: ReturnType<typeof dormRooms>; players: { room: number; name: string; status: string }[]; sealed: Record<number, string>; parity: boolean }) {
  const size = Math.max(11, Math.min(20, rooms[0]!.h * 0.62));
  return (
    <g>
      {rooms.map(({ n, x, y, w, h }) => {
        const who = players.find((p) => p.room === n);
        const gone = who && who.status !== "alive";
        const seal = sealed[n];
        const lit = parity && n % 2 === 0;
        return (
          <g key={n}>
            <rect x={x} y={y} width={w} height={h} rx={2} className="f" style={lit ? { fill: "rgba(127,216,255,.30)", stroke: "#bfeaff" } : undefined} />
            <rect x={x + 5} y={y + h * 0.2} width={34} height={h * 0.6} rx={3} className="f" />
            {!seal && (
              <>
                {/* The room's number on the bed, its occupant's first name beside it. */}
                <text x={x + 22} y={y + h * 0.7} textAnchor="middle" className="sublabel" style={{ fontSize: Math.min(size, 15), letterSpacing: 1, ...(lit ? { fill: "#e8f8ff" } : {}) }}>
                  {String(n).padStart(2, "0")}
                </text>
                {who && (
                  <text x={x + 46} y={y + h * 0.7} className="sublabel" style={{ fontSize: Math.min(size, 16, (w - 52) / Math.max(4, who.name.length) / 0.62), letterSpacing: 1, fill: gone ? "#ff6b6b" : lit ? "#e8f8ff" : "#bfeaff" }}>
                    {who.name.toUpperCase()}
                  </text>
                )}
              </>
            )}
            {gone && !seal && (
              <g>
                <rect x={x} y={y} width={w} height={h} fill="rgba(155,15,18,.22)" stroke="#9b0f12" strokeWidth="1.5" />
                {/* A red cross on the room of a dead or exiled subject. */}
                <line x1={x + 3} y1={y + 3} x2={x + w - 3} y2={y + h - 3} stroke="#d0181c" strokeWidth="2.5" />
                <line x1={x + w - 3} y1={y + 3} x2={x + 3} y2={y + h - 3} stroke="#d0181c" strokeWidth="2.5" />
              </g>
            )}
            {seal && (
              <g>
                <rect x={x} y={y} width={w} height={h} fill="rgba(155,15,18,.18)" stroke="#d0181c" strokeWidth="2" />
                <line x1={x} y1={y} x2={x + w} y2={y + h} stroke="#d0181c" strokeWidth="1" opacity=".6" />
                <text x={x + 6} y={y + h * 0.72} style={{ fontFamily: "var(--scn-font-vt)", fontSize: Math.min(size, 15), fill: "#ff6b6b", letterSpacing: 1 }}>
                  SCELLÉE
                </text>
                <text x={x + w - 6} y={y + h * 0.72} textAnchor="end" style={{ fontFamily: "var(--scn-font-vt)", fontSize: Math.min(size, (w * 1.1) / Math.max(4, seal.length)), fill: "#ffb3b3" }}>
                  {seal.toUpperCase()}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The sweep that reveals a space. */
function Scan({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect className="scanbar" x={x} y={y} width={w} height="30" style={{ "--h": `${Math.max(0, h - 30)}px` } as CSSProperties} />;
}

/** A door in its wall: the opening, the leaf that swings into the next space, its letter outside, a padlock while shut. */
function Door({ d, open, denied, blood }: { d: StationDoor; open: boolean; denied: boolean; blood: boolean }) {
  const len = 44;
  const gap = d.v ? { x: d.x - 5, y: d.y - len / 2, width: 10, height: len } : { x: d.x - len / 2, y: d.y - 5, width: len, height: 10 };
  const leaf = d.v ? [d.x, d.y - len / 2, d.x, d.y + len / 2] : [d.x - len / 2, d.y, d.x + len / 2, d.y];
  // Positive rotation is clockwise: a downward leaf swings to −x, a rightward one to +y.
  const swing = d.v ? -70 * d.into : 70 * d.into;
  const left = d.v && d.side === "l";
  const lx = d.v ? (left ? d.x - 12 : d.x + 12) : d.x + len / 2 + 8;
  const ly = d.v ? d.y - 2 : d.y + 9;
  const color = blood ? { fill: "#d0181c" } : undefined;
  return (
    <g className={`door ${open ? "open" : ""} ${denied ? "denied" : ""}`}>
      <rect className="gap" {...gap} />
      <line className="leaf" x1={leaf[0]} y1={leaf[1]} x2={leaf[2]} y2={leaf[3]} style={{ transformOrigin: `${leaf[0]}px ${leaf[1]}px`, transform: open ? `rotate(${swing}deg)` : "none", ...(blood ? { stroke: "#d0181c" } : {}) }} />
      <text className="greek" x={lx} y={ly} textAnchor={left ? "end" : "start"} style={{ fontSize: 24, ...color }}>
        {d.letter}
      </text>
      <path className="lock" style={color} d={`M${left ? lx - 30 : lx + 18} ${ly - 12}h12v10h-12z M${left ? lx - 27 : lx + 21} ${ly - 12}v-4a3 3 0 0 1 6 0v4`} />
      {blood && (
        <text x={lx} y={ly + 20} className="sublabel" style={{ fill: "#ff4d4d", fontSize: 14 }}>
          JAMAIS
        </text>
      )}
    </g>
  );
}
