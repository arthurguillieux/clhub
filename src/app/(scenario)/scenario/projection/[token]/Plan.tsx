import type { CSSProperties, ReactNode } from "react";

/**
 * The base, on Arthur's A3 plan (1600 × 820 units): the dormitory along the top (odd rooms above, even
 * below), then the airlock, the hall, the archives and the generators, the infirmary and the security
 * room, the service corridor, Alpha (never opens) and the laboratory along the bottom. Each zone shows
 * with a sweep once it's reached; the dormitory remembers the dead of earlier loops.
 */
type Zone = { id: string; x: number; y: number; w: number; h: number; letter: string; label: string; sub: string };

const ZONES: Zone[] = [
  { id: "sas", x: 40, y: 243, w: 260, h: 281, letter: "Θ", label: "SAS", sub: "COMBINAISONS · MOTONEIGE" },
  { id: "beta", x: 785, y: 243, w: 323, h: 141, letter: "Β", label: "ARCHIVES", sub: "CLASSEURS · RÉFECTOIRE" },
  { id: "generateurs", x: 1131, y: 243, w: 316, h: 141, letter: "Ε", label: "GÉNÉRATEURS", sub: "GROUPES A · B · C" },
  { id: "gamma", x: 785, y: 427, w: 323, h: 146, letter: "Γ", label: "INFIRMERIE", sub: "3 LITS · PHARMACIE" },
  { id: "securite", x: 1131, y: 427, w: 316, h: 146, letter: "Ζ", label: "PC SÉCURITÉ", sub: "RADIO · ÉCRANS" },
  { id: "labo", x: 671, y: 664, w: 872, h: 136, letter: "Η", label: "LABORATOIRE", sub: "PAILLASSES · CHAMBRE FROIDE" },
];

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
}: {
  players: { id: string; name: string; room: number; status: "alive" | "dead" | "exiled" }[];
  sealed: Record<number, string>;
  light: boolean;
  doors: Record<string, boolean>;
  panicReady: boolean;
  /** The terminals that can be used now, by id. */
  hot: Record<string, boolean>;
  denied: boolean;
  /** Tour de garde, Confinement: the even rooms lit. */
  parity?: boolean;
  /** The base cut in two by a fire door. */
  confinement?: boolean;
}) {
  const shown = (id: string) => (id === "hall" ? light : id === "dortoir" ? light && !!doors.dortoir : !!doors[id]);
  const cls = (id: string) => `room ${shown(id) ? "revealed" : "unknown"}`;
  const rooms = Math.max(players.length, 2);
  const cols = Math.ceil(rooms / 2);
  const dx = 1229 / cols;
  const size = Math.max(12, Math.min(22, dx * 0.2));

  return (
    <svg viewBox="0 0 1600 820" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plan de la base">
      <defs>
        <pattern id="pj-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#0d2230" strokeWidth="1" />
        </pattern>
        <pattern id="pj-grid2" width="200" height="200" patternUnits="userSpaceOnUse">
          <path d="M200 0H0V200" fill="none" stroke="#123044" strokeWidth="1.4" />
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
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pj-rough">
          <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
      </defs>
      <rect width="1600" height="820" fill="url(#pj-grid)" />
      <rect width="1600" height="820" fill="url(#pj-grid2)" />
      <text x="1560" y="236" textAnchor="end" className="sublabel" style={{ fontSize: 16 }}>
        PLAN NIVEAU 0 · ÉCH. 1/200 · N ↑
      </text>
      <text x="170" y="580" textAnchor="middle" className="sublabel" style={{ fontSize: 16 }}>
        ↓ DEHORS · −45 °C
      </text>

      <g filter="url(#pj-glow)">
        {/* ── Δ Dortoir ── */}
        <g className={cls("dortoir")}>
          <rect className="wall" x="331" y="20" width="1229" height="194" />
          <text x="945" y="125" textAnchor="middle" className="qm unk">
            NON CARTOGRAPHIÉ
          </text>
          <g className="content">
            <g className="furn">
              {Array.from({ length: rooms }, (_, i) => {
                const n = i + 1;
                const odd = n % 2 === 1;
                const x = 331 + Math.floor(i / 2) * dx;
                const y = odd ? 20 : 134;
                const h = 80;
                const who = players.find((p) => p.room === n);
                const gone = who && who.status !== "alive";
                const seal = sealed[n];
                const lit = parity && !odd;
                return (
                  <g key={n}>
                    <rect x={x} y={y} width={dx} height={h} className="f" style={lit ? { fill: "rgba(127,216,255,.30)", stroke: "#bfeaff" } : { fill: "none" }} />
                    <rect x={x + 8} y={odd ? y + 8 : y + h - 22} width={dx * 0.36} height="14" className="f" rx="3" />
                    {!seal && (
                      <text x={x + dx / 2} y={y + h * 0.66} textAnchor="middle" className="sublabel" style={{ fontSize: size, ...(lit ? { fill: "#e8f8ff" } : {}) }}>
                        {String(n).padStart(2, "0")}
                      </text>
                    )}
                    {gone && !seal && <rect x={x} y={y} width={dx} height={h} fill="rgba(155,15,18,.22)" stroke="#9b0f12" strokeWidth="1.5" />}
                    {seal && (
                      <g>
                        <rect x={x} y={y} width={dx} height={h} fill="rgba(155,15,18,.18)" stroke="#d0181c" strokeWidth="2" />
                        <line x1={x} y1={y} x2={x + dx} y2={y + h} stroke="#d0181c" strokeWidth="1.5" />
                        <line x1={x + dx} y1={y} x2={x} y2={y + h} stroke="#d0181c" strokeWidth="1.5" />
                        <text x={x + dx / 2} y={y + h * 0.4} textAnchor="middle" style={{ fontFamily: "var(--scn-font-vt)", fontSize: Math.min(size, 18), fill: "#ff6b6b", letterSpacing: 2 }}>
                          SCELLÉE
                        </text>
                        <text x={x + dx / 2} y={y + h * 0.78} textAnchor="middle" style={{ fontFamily: "var(--scn-font-vt)", fontSize: Math.min(size + 4, 26, (dx * 1.7) / Math.max(5, seal.length)), fill: "#ffb3b3" }}>
                          {seal.toUpperCase()}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
            <text x="350" y="125" className="label" style={{ fontSize: 24 }}>
              Δ DORTOIR
            </text>
            <text x="1540" y="125" textAnchor="end" className="sublabel" style={{ fontSize: 16 }}>
              {rooms} CHAMBRES{parity ? " · PAIRES ÉCLAIRÉES" : ""}
            </text>
          </g>
          <Scan x={331} y={20} w={1229} h={194} />
        </g>

        {/* ── Hall ── */}
        <g className={cls("hall")}>
          <rect className="wall" x="331" y="243" width="422" height="311" />
          <text x="542" y="410" textAnchor="middle" className="qm unk">
            HALL
          </text>
          <g className="content">
            <text x="350" y="280" className="label">
              HALL
            </text>
            <g className="furn">
              <rect className="f" x="360" y="440" width="200" height="90" strokeDasharray="6 6" />
              <path className="f" d="M390 470 Q460 446 530 470 L524 494 Q460 474 396 494 Z" />
              <rect className="f" x="410" y="462" width="26" height="18" />
              <rect className="f" x="484" y="462" width="26" height="18" />
              <text x="370" y="455" className="sublabel" style={{ fontSize: 15 }}>
                ACCUEIL · 2 TERMINAUX
              </text>
              <rect className="f" x="700" y="270" width="34" height="50" />
              <text x="717" y="338" textAnchor="middle" className="sublabel" style={{ fontSize: 13 }}>
                DISJ.
              </text>
              <ellipse className="f" cx="650" cy="470" rx="60" ry="28" />
              <circle className="f" cx="600" cy="320" r="22" />
              <text x="560" y="365" className="sublabel" style={{ fontSize: 15 }}>
                COIN DÉTENTE
              </text>
            </g>
            <g filter="url(#pj-rough)">
              <path className="blood hi" d="M512 554 c4 -14 -2 -26 6 -40 c4 -8 2 -20 -4 -24 c-6 8 -6 20 -10 30 c-6 12 -4 26 8 34z" />
              <path className="blood" d="M540 552 c10 -10 6 -30 12 -46 4 -10 14 -22 6 -30 -10 -6 -16 8 -18 18 -2 14 -8 24 -6 40 1 8 2 14 6 18z" />
              <path d="M528 500c-18 -30 -40 -50 -60 -80" fill="none" stroke="#9b0f12" strokeWidth="6" strokeLinecap="round" opacity=".7" />
            </g>
            <circle className={`hot ${hot.accueil ? "live" : ""}`} cx="460" cy="470" r="24" />
          </g>
          <Scan x={331} y={243} w={422} h={311} />
        </g>

        {/* ── The zones of the access chain ── */}
        {ZONES.map((z) => (
          <g key={z.id} className={cls(z.id)}>
            <rect className="wall" x={z.x} y={z.y} width={z.w} height={z.h} />
            <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 8} textAnchor="middle" className="qm unk">
              NON CARTOGRAPHIÉ
            </text>
            <g className="content">
              <text x={z.x + 16} y={z.y + 34} className="label" style={{ fontSize: 24 }}>
                {z.letter} {z.label}
              </text>
              <text x={z.x + 16} y={z.y + z.h - 14} className="sublabel" style={{ fontSize: 14 }}>
                {z.sub}
              </text>
              <g className="furn">{FURNITURE[z.id]}</g>
              {z.id === "beta" && (
                <g className={`panic ${panicReady ? "ok" : ""}`}>
                  <rect className="pbox" x="985" y="262" width="110" height="74" />
                  <text x="1040" y="294" textAnchor="middle" className="ptxt" style={{ fontSize: 15 }}>
                    PANIC ROOM
                  </text>
                  <text x="1040" y="316" textAnchor="middle" className="ptxt" style={{ fontSize: 13 }}>
                    {panicReady ? "OPÉRATIONNELLE" : "BOÎTIER HS"}
                  </text>
                </g>
              )}
              {hot[z.id] !== undefined && <circle className={`hot ${hot[z.id] ? "live" : ""}`} cx={TERMINAL_AT[z.id]![0]} cy={TERMINAL_AT[z.id]![1]} r="24" />}
            </g>
            <Scan x={z.x} y={z.y} w={z.w} h={z.h} />
          </g>
        ))}

        {/* ── The corridors ── */}
        <path d="M753 384H1500V664H1447V427H753Z" fill="none" stroke="#2c6f8f" strokeWidth="1.5" strokeDasharray="4 6" />
        <text x="1474" y="560" textAnchor="middle" className="sublabel" style={{ fontSize: 13 }} transform="rotate(90 1474 560)">
          COULOIR DE SERVICE
        </text>
        <path d="M520 554V664M560 554V664" fill="none" stroke="#2c6f8f" strokeWidth="1.5" strokeDasharray="4 6" />

        {/* ── Α Alpha: always unknown, the blood door ── */}
        <g className="room unknown">
          <rect className="wall" x="40" y="664" width="600" height="136" style={{ stroke: "#9b0f12" }} />
          <rect x="40" y="664" width="600" height="136" fill="url(#pj-hatch)" opacity=".35" />
          <text x="60" y="700" className="label" style={{ fill: "#d0181c", fontSize: 24 }}>
            Α ALPHA
          </text>
          <text x="340" y="745" textAnchor="middle" className="qm" style={{ fill: "#d0181c" }}>
            ?
          </text>
          <text x="340" y="785" textAnchor="middle" className="sublabel" style={{ fill: "#ff6b6b", fontSize: 15 }}>
            ACCÈS RESTREINT
          </text>
        </g>
      </g>

      {confinement && (
        <g>
          <rect x="0" y="0" width="945" height="820" fill="rgba(255,178,62,.06)" />
          <line x1="945" y1="10" x2="945" y2="810" stroke="#ff4d4d" strokeWidth="6" strokeDasharray="22 10" />
          <text x="925" y="236" textAnchor="end" className="sublabel" style={{ fill: "#ffb23e", fontSize: 20 }}>
            CHAMBRES IMPAIRES
          </text>
          <text x="965" y="236" className="sublabel" style={{ fill: "#7fd8ff", fontSize: 20 }}>
            CHAMBRES PAIRES
          </text>
          <text x="945" y="660" textAnchor="middle" className="sublabel" style={{ fill: "#ff4d4d", fontSize: 22 }}>
            PORTE COUPE-FEU
          </text>
        </g>
      )}

      <Door open={!!doors.dortoir} x={470} y={214} len={60} letter="Δ" />
      <Door open={!!doors.sas} x={300} y={400} len={56} vertical letter="Θ" />
      <Door open={!!doors.beta} x={915} y={384} len={64} letter="Β" left swing={38} />
      <Door open={!!doors.gamma} x={1010} y={427} len={64} letter="Γ" swing={-38} />
      <Door open={!!doors.generateurs} x={1255} y={384} len={64} letter="Ε" left swing={38} />
      <Door open={!!doors.securite} x={1345} y={427} len={64} letter="Ζ" swing={-38} />
      <Door open={!!doors.labo} x={1447} y={664} len={53} letter="Η" below swing={-70} />
      <Door open={false} denied={denied} x={512} y={664} len={56} letter="Α" blood />
    </svg>
  );
}

const TERMINAL_AT: Record<string, [number, number]> = { beta: [860, 300], securite: [1290, 500], labo: [1100, 730] };

const FURNITURE: Record<string, ReactNode> = {
  sas: (
    <>
      {[70, 110, 150].map((x) => (
        <rect key={x} className="f" x={x} y="300" width="28" height="70" rx="4" />
      ))}
      <rect className="f" x="200" y="400" width="80" height="44" rx="10" />
      <rect className="f" x="70" y="420" width="60" height="34" />
    </>
  ),
  beta: (
    <>
      <rect className="f" x="805" y="300" width="150" height="20" />
      {[835, 865, 895, 925].map((x) => (
        <line key={x} x1={x} y1="300" x2={x} y2="320" />
      ))}
    </>
  ),
  generateurs: (
    <>
      {[1160, 1250, 1340].map((x) => (
        <g key={x}>
          <rect className="f" x={x} y="275" width="70" height="60" rx="4" />
          <circle cx={x + 35} cy="305" r="16" className="f" />
        </g>
      ))}
    </>
  ),
  gamma: (
    <>
      {[810, 880, 950].map((x) => (
        <g key={x}>
          <rect className="f" x={x} y="470" width="50" height="70" rx="5" />
          <line x1={x} y1="490" x2={x + 50} y2="490" />
        </g>
      ))}
      <rect className="f" x="1030" y="455" width="60" height="34" />
      <path className="blood" d="M1010 520c8-6 22-4 30 4 6 7 4 18-4 22-9 5-12 16-22 14-11-2-14-14-10-22 2-6 1-13 6-18z" opacity=".8" filter="url(#pj-rough)" />
    </>
  ),
  securite: (
    <>
      {[1160, 1200, 1240].map((x) => (
        <rect key={x} className="f" x={x} y="470" width="32" height="24" />
      ))}
      <rect className="f" x="1150" y="500" width="110" height="20" />
      <rect className="f" x="1360" y="460" width="60" height="70" />
      <line x1="1390" y1="460" x2="1390" y2="440" />
    </>
  ),
  labo: (
    <>
      {[720, 860, 1000].map((x) => (
        <rect key={x} className="f" x={x} y="730" width="110" height="26" />
      ))}
      <rect className="f" x="1180" y="700" width="160" height="70" />
      <rect className="f" x="1380" y="700" width="140" height="70" strokeDasharray="5 5" />
    </>
  ),
};

/** The sweep that reveals a zone. */
function Scan({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect className="scanbar" x={x} y={y} width={w} height="40" style={{ "--h": `${h - 40}px` } as CSSProperties} />;
}

/** A door in a wall: horizontal (in a wall along x) or vertical; its letter beside, a padlock while closed. */
function Door({ open, denied = false, x, y, len, vertical = false, below = false, left = false, blood = false, swing = 75, letter }: { open: boolean; denied?: boolean; x: number; y: number; len: number; vertical?: boolean; below?: boolean; left?: boolean; blood?: boolean; swing?: number; letter: string }) {
  const gap = vertical ? { x: x - 6, y, width: 12 + 19, height: len } : { x, y: y - 8, width: len, height: 16 };
  const leaf = vertical ? [x + 15, y, x + 15, y + len] : [x, y, x + len, y];
  const at = vertical ? [x + 8, y - 10] : left ? [x - 30, y + 30] : [x + len + 8, below ? y + 26 : y - 10];
  const lx = vertical ? x + 8 : x + len / 2 - 7;
  const ly = vertical ? y + len / 2 - 6 : y - 6;
  return (
    <g className={`door ${open ? "open" : ""} ${denied ? "denied" : ""}`}>
      <rect className="gap" {...gap} />
      <line className="leaf" x1={leaf[0]} y1={leaf[1]} x2={leaf[2]} y2={leaf[3]} style={{ transformOrigin: `${leaf[0]}px ${leaf[1]}px`, transform: open ? `rotate(${swing}deg)` : "none", ...(blood ? { stroke: "#d0181c" } : {}) }} />
      <text className="greek" x={at[0]} y={at[1]} style={blood ? { fill: "#d0181c" } : undefined}>
        {letter}
      </text>
      <path className="lock" d={`M${lx} ${ly + 4}h14v12h-14z M${lx + 3} ${ly + 4}v-5a4 4 0 0 1 8 0v5`} />
      {blood && (
        <text x={x + len / 2} y={y - 18} textAnchor="middle" className="sublabel" style={{ fill: "#ff4d4d", fontSize: 15 }}>
          JAMAIS
        </text>
      )}
    </g>
  );
}
