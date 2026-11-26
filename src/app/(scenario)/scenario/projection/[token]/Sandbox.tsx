"use client";

import { useEffect, useState } from "react";
import { PROPS, SPACES, type SpaceId } from "@/modules/loups/scenarios/station";

/**
 * The sandbox on the room's screen (the mockup of 23/11): the group's things in their slots, a piece of
 * furniture close up as the players search it, the key that flies, the door that opens on what's behind.
 */

const AMBER = "#ffb23e";
export const KEY_PATH = (
  <>
    <circle cx="13" cy="14" r="10" fill="none" stroke={AMBER} strokeWidth="5" />
    <path d="M23 14h37M50 14v10M42 14v7" stroke={AMBER} strokeWidth="5" fill="none" strokeLinecap="round" />
  </>
);
const KeyIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 64 28" aria-hidden className={className}>
    {KEY_PATH}
  </svg>
);

/** The group's things, bottom right: six slots, filled as they find them. */
export function Inventory({ items }: { items: { id: string; name: string }[] }) {
  return (
    <div className="pj-inv" aria-label="Objets du groupe">
      <p>OBJETS DU GROUPE</p>
      <div>
        {Array.from({ length: 6 }, (_, i) => {
          const it = items[i];
          return (
            <span key={i} className={it ? "full" : ""} data-slot={it?.id}>
              {it ? (
                <>
                  <KeyIcon />
                  <b>{it.name.toUpperCase()}</b>
                </>
              ) : (
                "—"
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The key that leaves its hiding place for the group's slots (or the slots for a lock). */
export function FlyingKey({ to }: { to: "slot" | "lock" }) {
  return (
    <div className={`pj-flykey ${to === "slot" ? "to-slot" : "to-lock"}`} aria-hidden>
      <KeyIcon />
    </div>
  );
}

/**
 * A piece of furniture close up: what the gestures change (the screen on, the keyboard lifted, the mouse,
 * the drawer, the cushions), what was hidden there while it's still there, the post-it, a password being typed.
 */
export function PropScene({
  prop,
  gestures,
  hides,
  notes,
  inventory,
  unlocked,
  typing,
  boot,
  files,
}: {
  prop: string;
  gestures: string[];
  hides: Record<string, string>;
  notes: Record<string, string>;
  inventory: string[];
  unlocked: boolean;
  typing: { text: string; ok: boolean } | null;
  boot: string;
  files: string[];
}) {
  const on = (g: string) => gestures.includes(`${prop}.${g}`);
  const keyUnder = (g: string) => {
    const thing = hides[`${prop}.${g}`];
    return !!thing && !inventory.includes(thing) && on(g);
  };
  const note = (g: string) => (on(g) ? notes[`${prop}.${g}`] : undefined);
  const typed = useTyped(typing?.text ?? "");
  const p = PROPS.find((x) => x.id === prop);
  if (!p) return null;

  if (prop === "ordi") {
    const power = on("allume");
    const done = typing && typed.length >= typing.text.length;
    let screen;
    if (!power)
      screen = (
        <text x="400" y="160" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="20" fill="#24394a">
          — ÉTEINT —
        </text>
      );
    else if (unlocked && (!typing || done))
      screen = (
        <>
          <text x="290" y="96" fontFamily="var(--scn-font-vt)" fontSize="21" fill="#5fe39a">
            ACCÈS AUTORISÉ
          </text>
          {files.slice(0, 5).map((f, i) => (
            <text key={f} x="290" y={128 + i * 24} fontFamily="var(--scn-font-vt)" fontSize="19" fill={AMBER}>
              {f}
            </text>
          ))}
        </>
      );
    else
      screen = (
        <>
          {boot
            .split("\n")
            .slice(0, 2)
            .map((l, i) => (
              <text key={i} x="290" y={100 + i * 26} fontFamily="var(--scn-font-vt)" fontSize="20" fill={AMBER}>
                {l}
              </text>
            ))}
          <text x="290" y="168" fontFamily="var(--scn-font-vt)" fontSize="24" fill="#ffcf7a">
            MOT DE PASSE : {typed}_
          </text>
          {done && !typing!.ok && (
            <text x="290" y="204" fontFamily="var(--scn-font-vt)" fontSize="22" fill="#ff6b6b">
              MOT DE PASSE INCORRECT
            </text>
          )}
        </>
      );
    const kb = on("clavier");
    const ms = on("souris");
    return (
      <div className="pj-scene">
        <svg viewBox="0 0 800 450" role="img" aria-label={p.name}>
          <rect x="0" y="330" width="800" height="120" fill="#0d1820" />
          <line x1="0" y1="330" x2="800" y2="330" stroke="#24394a" strokeWidth="3" />
          <rect x="250" y="40" width="300" height="220" rx="14" fill="#1a2630" stroke="#3f6f88" strokeWidth="4" />
          <rect x="272" y="62" width="256" height="176" rx="8" fill={power ? "#130d03" : "#05080c"} />
          {screen}
          <rect x="370" y="260" width="60" height="50" fill="#1a2630" />
          <rect x="320" y="305" width="160" height="22" rx="4" fill="#1a2630" stroke="#3f6f88" strokeWidth="3" />
          {keyUnder("clavier") && <g transform="translate(300 360) scale(1.6)">{KEY_PATH}</g>}
          <g style={{ transition: "transform .6s cubic-bezier(.4,0,.2,1)", transform: kb ? "translate(0px,-70px) rotate(-8deg)" : "none", transformOrigin: "330px 375px" }}>
            <rect x="170" y="350" width="330" height="62" rx="8" fill="#22313c" stroke="#3f6f88" strokeWidth="3" />
            {Array.from({ length: 39 }, (_, i) => (
              <rect key={i} x={182 + (i % 13) * 24} y={358 + Math.floor(i / 13) * 17} width="19" height="12" rx="2" fill="#2f4352" />
            ))}
          </g>
          {note("souris") && (
            <g transform="rotate(-6 600 390)">
              <rect x="548" y="352" width="110" height="80" fill="#f3e27a" />
              {note("souris")!
                .split(/(?<=:) /)
                .map((l, i) => (
                  <text key={i} x="603" y={384 + i * 26} textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize={i ? 22 : 17} fill="#3a3210">
                    {l}
                  </text>
                ))}
            </g>
          )}
          {keyUnder("souris") && <g transform="translate(680 380) scale(1.1)">{KEY_PATH}</g>}
          <g style={{ transition: "transform .5s ease", transform: ms ? "translate(70px,-60px)" : "none" }}>
            <ellipse cx="590" cy="385" rx="26" ry="36" fill="#22313c" stroke="#3f6f88" strokeWidth="3" />
            <line x1="590" y1="352" x2="590" y2="372" stroke="#3f6f88" strokeWidth="3" />
          </g>
          <text x="400" y="440" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="22" letterSpacing="3" fill="#5d7a8c">
            ACCUEIL · TERMINAL 01
          </text>
        </svg>
      </div>
    );
  }

  // A drawer, cushions: something that opens, and what lies inside.
  const g = p.gestures[0]!;
  const opened = on(g.id);
  const keyHere = keyUnder(g.id);
  const label = p.name.replace(/^L'|^Le |^La /, "").toUpperCase();
  return (
    <div className="pj-scene">
      <svg viewBox="0 0 800 450" role="img" aria-label={p.name}>
        <rect x="0" y="330" width="800" height="120" fill="#0d1820" />
        <rect x="200" y="140" width="400" height="200" rx="10" fill="#1a2630" stroke="#3f6f88" strokeWidth="4" />
        <rect x="250" y={opened ? 250 : 230} width="300" height={opened ? 110 : 80} rx="6" fill="#22313c" stroke="#3f6f88" strokeWidth="3" style={{ transition: "all .5s ease" }} />
        {keyHere && <g transform="translate(350 290) scale(1.6)">{KEY_PATH}</g>}
        {opened && !keyHere && (
          <text x="400" y="315" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="22" fill="#8fa6b6">
            {prop === "comptoir" ? "des stylos, un tampon, un vieux ticket" : "des miettes, une pièce de 1 franc"}
          </text>
        )}
        <text x="400" y="110" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="34" letterSpacing="4" fill="#bfeaff">
          {label}
        </text>
      </svg>
    </div>
  );
}

/** A password typed letter by letter, as the players dictate it. */
function useTyped(text: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reset = setTimeout(() => setN(0), 0);
    const t = setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), 140);
    return () => {
      clearTimeout(reset);
      clearInterval(t);
    };
  }, [text]);
  return text.slice(0, n);
}

/** A door opening on what's behind it, full screen: its two leaves part (after the key, if one was used). */
export function DoorOpening({ letter, dest, withKey }: { letter: string; dest: SpaceId; withKey: boolean }) {
  const name = SPACES.find((x) => x.id === dest)?.name ?? "";
  const corridor = dest === "couloir" || dest === "dortoir";
  return (
    <div className={`pj-dooropen ${withKey ? "with-key" : ""}`} aria-label={`La porte ${letter} s'ouvre`}>
      <svg viewBox="0 0 800 450">
        <rect width="800" height="450" fill="#020406" />
        {corridor ? <Corridor rooms={dest === "dortoir"} /> : <rect x="160" y="30" width="480" height="400" fill="#0c1820" />}
        {!corridor && (
          <text x="400" y="240" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="40" letterSpacing="4" fill="#bfeaff">
            {name}
          </text>
        )}
        <g className="leaf-l">
          <rect x="160" y="30" width="240" height="400" fill="#16232d" stroke="#3f6f88" strokeWidth="4" />
          <text x="380" y="240" textAnchor="end" fontFamily="var(--scn-font-vt)" fontSize="80" fill="#7fd8ff">
            {letter}
          </text>
        </g>
        <g className="leaf-r">
          <rect x="400" y="30" width="240" height="400" fill="#16232d" stroke="#3f6f88" strokeWidth="4" />
          <circle className="lock" cx="430" cy="240" r="16" fill="#0a1117" strokeWidth="4" />
        </g>
        <rect x="150" y="20" width="500" height="420" fill="none" stroke="#2c4252" strokeWidth="10" />
      </svg>
      {withKey && <FlyingKey to="lock" />}
    </div>
  );
}

function Corridor({ rooms }: { rooms: boolean }) {
  const sides = rooms ? 4 : 2;
  return (
    <g>
      <polygon points="160,30 640,30 470,180 330,180" fill="#0c1820" />
      <polygon points="160,430 640,430 470,280 330,280" fill="#0f1c26" />
      <polygon points="160,30 330,180 330,280 160,430" fill="#0a141b" />
      <polygon points="640,30 470,180 470,280 640,430" fill="#0a141b" />
      <rect x="330" y="180" width="140" height="100" fill="#132634" stroke="#3f6f88" strokeWidth="2" />
      <rect x="380" y="200" width="40" height="80" fill="#0a1117" stroke="#7fd8ff" strokeWidth="2" />
      {Array.from({ length: sides }, (_, i) => {
        const t = i / sides;
        const t2 = (i + 0.55) / sides;
        const xl = 160 + 170 * t;
        const xl2 = 160 + 170 * t2;
        const yt = 30 + 150 * t;
        const yb = 430 - 150 * t;
        const yt2 = 30 + 150 * t2;
        const yb2 = 430 - 150 * t2;
        const xr = 640 - 170 * t;
        const xr2 = 640 - 170 * t2;
        return (
          <g key={i}>
            <polygon points={`${xl},${yt + (yb - yt) * 0.3} ${xl2},${yt2 + (yb2 - yt2) * 0.3} ${xl2},${yb2} ${xl},${yb}`} fill="#16283a" stroke="#3f6f88" strokeWidth="2" />
            <polygon points={`${xr},${yt + (yb - yt) * 0.3} ${xr2},${yt2 + (yb2 - yt2) * 0.3} ${xr2},${yb2} ${xr},${yb}`} fill="#16283a" stroke="#3f6f88" strokeWidth="2" />
            {rooms && (
              <>
                <text x={(xl + xl2) / 2} y={yt + (yb - yt) * 0.26} textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize={22 - i * 3} fill="#8fa6b6">
                  {String(i * 2 + 1).padStart(2, "0")}
                </text>
                <text x={(xr + xr2) / 2} y={yt + (yb - yt) * 0.26} textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize={22 - i * 3} fill="#8fa6b6">
                  {String(i * 2 + 2).padStart(2, "0")}
                </text>
              </>
            )}
          </g>
        );
      })}
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} x={380 - i * 30} y={36 + i * 30} width={40 + i * 60} height="4" fill="#bfeaff" opacity={0.5 - i * 0.08} />
      ))}
    </g>
  );
}
