/**
 * The base, as the mockup drew it (1600 × 820 units): Alpha (always unknown), the infirmary Γ, the
 * dormitory Δ (as many rooms as players), the Beta wing with the panic room, the hall. Rooms show
 * once lit or opened; the dormitory remembers the dead of earlier loops.
 */
export function Plan({
  players,
  sealed,
  light,
  doors,
  panicReady,
  hot,
  denied,
}: {
  players: { id: string; name: string; room: number; status: "alive" | "dead" | "exiled" }[];
  sealed: Record<number, string>;
  light: boolean;
  doors: Record<string, boolean>;
  panicReady: boolean;
  hot: { accueil: boolean; beta: boolean };
  denied: boolean;
}) {
  const revealed = { hall: light, dortoir: light && !!doors.dortoir, beta: !!doors.beta, gamma: !!doors.gamma };
  const room = (id: keyof typeof revealed) => `room ${revealed[id] ? "revealed" : "unknown"}`;
  const rooms = Math.max(players.length, 2);
  const rows = Math.ceil(rooms / 2);
  const top = 180;
  const h = 520 / rows;
  const size = Math.max(12, Math.min(18, h * 0.32));

  return (
    <svg viewBox="0 0 1600 820" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plan de la base">
      <defs>
        <pattern id="pj-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#0d2230" strokeWidth="1" />
        </pattern>
        <pattern id="pj-grid2" width="200" height="200" patternUnits="userSpaceOnUse">
          <path d="M200 0H0V200" fill="none" stroke="#123044" strokeWidth="1.4" />
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
      <text x="1560" y="806" textAnchor="end" className="sublabel">
        PLAN NIVEAU 0 · ÉCH. 1/200 · N ↑
      </text>

      <g filter="url(#pj-glow)">
        <g className="room unknown">
          <rect className="wall" x="560" y="40" width="480" height="340" />
          <text x="800" y="200" textAnchor="middle" className="label" style={{ fill: "#5a1416" }}>
            Α
          </text>
          <text x="800" y="235" textAnchor="middle" className="qm" style={{ fill: "#5a1416" }}>
            AILE ALPHA · ACCÈS RESTREINT
          </text>
        </g>

        <g className={room("gamma")}>
          <rect className="wall" x="1080" y="40" width="480" height="340" />
          <text x="1320" y="215" textAnchor="middle" className="qm unk">
            NON CARTOGRAPHIÉ
          </text>
          <g className="content">
            <text x="1100" y="78" className="label">
              Γ INFIRMERIE
            </text>
            <g className="furn">
              {[1110, 1220, 1330].map((x) => (
                <g key={x}>
                  <rect className="f" x={x} y="130" width="70" height="170" rx="6" />
                  <line x1={x} y1="160" x2={x + 70} y2="160" />
                </g>
              ))}
              <rect className="f" x="1450" y="70" width="90" height="40" />
              <rect className="f" x="1450" y="120" width="90" height="40" />
              <circle cx="1495" cy="320" r="24" className="f" />
              <line x1="1495" y1="296" x2="1495" y2="344" />
              <line x1="1471" y1="320" x2="1519" y2="320" />
            </g>
            <text x="1110" y="340" className="sublabel">
              3 LITS · ARMOIRE À PHARMACIE
            </text>
            <path className="blood" d="M1338 210c8-6 22-4 30 4 6 7 4 18-4 22-9 5-12 16-22 14-11-2-14-14-10-22 2-6 1-13 6-18z" opacity=".85" filter="url(#pj-rough)" />
          </g>
          <rect className="scanbar" x="1080" y="40" width="480" height="40" style={{ "--h": "300px" } as React.CSSProperties} />
        </g>

        <g className={room("dortoir")}>
          <rect className="wall" x="40" y="180" width="480" height="600" />
          <text x="280" y="480" textAnchor="middle" className="qm unk">
            NON CARTOGRAPHIÉ
          </text>
          <g className="content">
            <text x="60" y="168" className="label" style={{ fontSize: 26 }}>
              Δ DORTOIR
            </text>
            <g className="furn">
              {Array.from({ length: rooms }, (_, i) => {
                const n = i + 1;
                const left = i % 2 === 0;
                const x = left ? 40 : 310;
                const y = top + Math.floor(i / 2) * h;
                const who = players.find((p) => p.room === n);
                const gone = who && who.status !== "alive";
                const seal = sealed[n];
                return (
                  <g key={n}>
                    <rect x={x} y={y} width="210" height={h} className="f" fill="none" />
                    <rect x={left ? x + 12 : x + 154} y={y + h * 0.14} width="44" height={h * 0.72} className="f" rx="4" />
                    {!seal && (
                      <text x={left ? x + 110 : x + 70} y={y + h * 0.6} className="sublabel" style={{ fontSize: size }}>
                        CH.{String(n).padStart(2, "0")}
                      </text>
                    )}
                    {gone && !seal && <rect x={x} y={y} width="210" height={h} fill="rgba(155,15,18,.22)" stroke="#9b0f12" strokeWidth="1.5" />}
                    {seal && (
                      <g>
                        <rect x={x} y={y} width="210" height={h} fill="rgba(155,15,18,.18)" stroke="#d0181c" strokeWidth="2" />
                        <line x1={x} y1={y} x2={x + 210} y2={y + h} stroke="#d0181c" strokeWidth="2" />
                        <line x1={x + 210} y1={y} x2={x} y2={y + h} stroke="#d0181c" strokeWidth="2" />
                        {/* Two lines that always fit the room: « SCELLÉE », then the name, as wide as it can be. */}
                        <text x={x + 105} y={y + h * 0.42} textAnchor="middle" style={{ fontFamily: "var(--scn-font-vt)", fontSize: Math.min(size, h * 0.3), fill: "#ff6b6b", letterSpacing: 3 }}>
                          SCELLÉE
                        </text>
                        <text x={x + 105} y={y + h * 0.8} textAnchor="middle" style={{ fontFamily: "var(--scn-font-vt)", fontSize: Math.min(size + 6, h * 0.38, 330 / Math.max(6, seal.length)), fill: "#ffb3b3", letterSpacing: 1 }}>
                          {seal.toUpperCase()}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
            <rect x="250" y="180" width="60" height="520" fill="none" stroke="#2c6f8f" strokeDasharray="4 6" />
            <text x="60" y="748" className="sublabel">
              SAS · {rooms} CHAMBRES INDIVIDUELLES
            </text>
            <path d="M300 690c10 8 30 10 52 16 30 8 60 4 92 12 26 6 50 18 70 30" fill="none" stroke="#9b0f12" strokeWidth="7" strokeLinecap="round" opacity=".8" filter="url(#pj-rough)" />
          </g>
          <rect className="scanbar" x="40" y="180" width="480" height="40" style={{ "--h": "560px" } as React.CSSProperties} />
        </g>

        <g className={room("beta")}>
          <rect className="wall" x="1080" y="400" width="480" height="380" />
          <text x="1320" y="600" textAnchor="middle" className="qm unk">
            NON CARTOGRAPHIÉ
          </text>
          <g className="content">
            <text x="1100" y="438" className="label">
              Β ARCHIVES
            </text>
            <g className="furn">
              <rect className="f" x="1100" y="455" width="190" height="26" />
              {[1138, 1176, 1214, 1252].map((x) => (
                <line key={x} x1={x} y1="455" x2={x} y2="481" />
              ))}
              <text x="1100" y="500" className="sublabel" style={{ fontSize: 18 }}>
                CARTONS « NOËL » · CLASSEURS
              </text>
              <rect className="f" x="1110" y="520" width="110" height="46" />
              <rect className="f" x="1140" y="526" width="38" height="28" />
              <rect className="f" x="1110" y="625" width="200" height="42" rx="6" />
              <rect className="f" x="1110" y="705" width="200" height="42" rx="6" />
              {[625, 705].flatMap((y) =>
                [1130, 1170, 1210, 1250, 1290].flatMap((x) => [<circle key={`${x}-${y}-a`} cx={x} cy={y - 10} r="8" className="f" />, <circle key={`${x}-${y}-b`} cx={x} cy={y + 52} r="8" className="f" />]),
              )}
              <path className="f" d="M1400 640h150v130h-40v-90h-110z" />
              <circle cx="1525" cy="665" r="9" />
              <circle cx="1500" cy="665" r="9" />
              <text x="1400" y="632" className="sublabel" style={{ fontSize: 18 }}>
                CUISINE
              </text>
            </g>
            <g className={`panic ${panicReady ? "ok" : ""}`}>
              <rect className="pbox" x="1400" y="450" width="145" height="100" />
              <text x="1472" y="495" textAnchor="middle" className="ptxt">
                PANIC ROOM
              </text>
              <text x="1472" y="519" textAnchor="middle" className="ptxt">
                {panicReady ? "OPÉRATIONNELLE" : "BOÎTIER HS"}
              </text>
              <rect x="1382" y="485" width="14" height="28" fill="#2a3138" stroke={panicReady ? "#5fe39a" : "#ff4d4d"} strokeWidth="2" />
            </g>
            <circle className={`hot ${hot.beta ? "live" : ""}`} cx="1159" cy="540" r="26" />
          </g>
          <rect className="scanbar" x="1080" y="400" width="480" height="40" style={{ "--h": "340px" } as React.CSSProperties} />
        </g>

        <g className={room("hall")}>
          <rect className="wall" x="540" y="400" width="520" height="380" />
          <text x="800" y="600" textAnchor="middle" className="qm unk">
            HALL
          </text>
          <g className="content">
            <text x="560" y="438" className="label">
              HALL
            </text>
            <g className="furn">
              <path className="f" d="M690 470 Q800 430 910 470 L900 505 Q800 470 700 505 Z" />
              <rect className="f" x="728" y="462" width="34" height="22" />
              <rect className="f" x="838" y="462" width="34" height="22" />
              <text x="800" y="530" textAnchor="middle" className="sublabel" style={{ fontSize: 18 }}>
                ACCUEIL · 2 TERMINAUX
              </text>
              <path className="f" d="M570 600h130v28h-102v110h-28z" />
              <rect className="f" x="725" y="660" width="40" height="40" rx="6" transform="rotate(-18 745 680)" />
              <circle className="f" cx="660" cy="680" r="28" />
              <rect className="f" x="580" y="748" width="70" height="20" />
              <text x="585" y="592" className="sublabel" style={{ fontSize: 18 }}>
                COIN DÉTENTE
              </text>
              <rect className="f" x="985" y="420" width="44" height="66" />
              <text x="1007" y="505" textAnchor="middle" className="sublabel" style={{ fontSize: 15 }}>
                DISTRIB.
              </text>
              <ellipse className="f" cx="910" cy="660" rx="80" ry="34" />
              {Array.from({ length: 8 }, (_, a) => {
                const t = (a / 8) * Math.PI * 2;
                return <circle key={a} cx={910 + Math.cos(t) * 100} cy={660 + Math.sin(t) * 50} r="8" className="f" />;
              })}
            </g>
            <g filter="url(#pj-rough)">
              <path className="blood hi" d="M770 400 c4 14 -2 26 6 40 c4 8 2 20 -4 24 c-6 -8 -6 -20 -10 -30 c-6 -12 -4 -26 8 -34z" />
              <path className="blood" d="M800 402 c10 10 6 30 12 46 4 10 14 22 6 30 -10 6 -16 -8 -18 -18 -2 -14 -8 -24 -6 -40 1-8 2-14 6-18z" />
              <path className="blood" d="M822 404 c6 6 4 16 2 24 -2 6 -8 4 -8 -2 0 -8 2 -16 6 -22z" />
              <path d="M780 470c18 30 50 54 70 92 14 28 4 60 30 88" fill="none" stroke="#9b0f12" strokeWidth="6" strokeLinecap="round" opacity=".75" />
              <ellipse className="blood" cx="895" cy="760" rx="22" ry="9" opacity=".8" />
            </g>
            <circle className={`hot ${hot.accueil ? "live" : ""}`} cx="745" cy="473" r="26" />
          </g>
          <rect className="scanbar" x="540" y="400" width="520" height="40" style={{ "--h": "340px" } as React.CSSProperties} />
        </g>
      </g>

      <g>
        <rect x="760" y="772" width="90" height="16" fill="#05080c" />
        <line x1="760" y1="780" x2="850" y2="780" stroke="#7fd8ff" strokeWidth="2" strokeDasharray="3 5" />
        <text x="805" y="810" textAnchor="middle" className="sublabel" style={{ fontSize: 18 }}>
          ENTRÉE · EXTÉRIEUR
        </text>
      </g>
      <Door id="dortoir" open={!!doors.dortoir} gap={[520, 708, 40, 56]} leaf={[540, 708, 540, 764]} letter="Δ" at={[548, 700]} lock="M546 728h14v12h-14z M549 728v-5a4 4 0 0 1 8 0v5" turn="rotate(80deg)" />
      <Door id="beta" open={!!doors.beta} gap={[1050, 560, 40, 64]} leaf={[1070, 560, 1070, 624]} letter="Β" at={[1080, 552]} lock="M1063 585h14v12h-14z M1066 585v-5a4 4 0 0 1 8 0v5" turn="rotate(80deg)" />
      <Door id="gamma" open={!!doors.gamma} gap={[1190, 370, 66, 40]} leaf={[1190, 390, 1256, 390]} letter="Γ" at={[1264, 398]} lock="M1216 384h14v12h-14z M1219 384v-5a4 4 0 0 1 8 0v5" turn="rotate(-80deg)" />
      <Door id="alpha" open={false} denied={denied} gap={[768, 370, 66, 40]} leaf={[768, 390, 834, 390]} letter="Α" at={[842, 398]} lock="M794 384h14v12h-14z M797 384v-5a4 4 0 0 1 8 0v5" turn="none" />
    </svg>
  );
}

function Door({
  open,
  denied = false,
  gap,
  leaf,
  letter,
  at,
  lock,
  turn,
}: {
  id: string;
  open: boolean;
  denied?: boolean;
  gap: [number, number, number, number];
  leaf: [number, number, number, number];
  letter: string;
  at: [number, number];
  lock: string;
  turn: string;
}) {
  return (
    <g className={`door ${open ? "open" : ""} ${denied ? "denied" : ""}`}>
      <rect className="gap" x={gap[0]} y={gap[1]} width={gap[2]} height={gap[3]} />
      <line className="leaf" x1={leaf[0]} y1={leaf[1]} x2={leaf[2]} y2={leaf[3]} style={{ transformOrigin: `${leaf[0]}px ${leaf[1]}px`, transform: open ? turn : "none" }} />
      <text className="greek" x={at[0]} y={at[1]}>
        {letter}
      </text>
      <path className="lock" d={lock} />
    </g>
  );
}
