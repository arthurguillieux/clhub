"use client";

import { useEffect, useState } from "react";
import { PROPS, SPACES, type SpaceId } from "@/modules/loups/scenarios/station";
export { useTyped };

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

/**
 * Each thing its own drawing, in the slots and when it flies there: the key, a yellow post-it (the
 * password's, the generators' code), an access badge with its level, the flare pistol, a cassette for the
 * tapes, the syringes. Anything else: a key.
 */
export function ObjectIcon({ id, className = "" }: { id: string; className?: string }) {
  const stroke = { fill: "none", stroke: AMBER, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id.startsWith("postit") || id.startsWith("code")) {
    return (
      <svg viewBox="0 0 48 48" aria-hidden className={className}>
        <path d="M6 6h36v26l-10 10H6z" fill="#f3e27a" />
        <path d="M42 32H32v10z" fill="#c9b84f" />
        {id.startsWith("code") ? (
          <text x="24" y="27" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="13" fill="#3a3210">
            ••••
          </text>
        ) : (
          <path d="M12 16h24M12 23h20M12 30h14" stroke="#3a3210" strokeWidth="2.5" strokeLinecap="round" />
        )}
      </svg>
    );
  }
  if (id.startsWith("badge")) {
    return (
      <svg viewBox="0 0 48 48" aria-hidden className={className}>
        <rect x="9" y="6" width="30" height="38" rx="4" {...stroke} />
        <rect x="19" y="10" width="10" height="3" rx="1.5" fill={AMBER} />
        <rect x="9" y="18" width="30" height="5" fill={AMBER} opacity=".5" />
        <text x="24" y="38" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="14" fill={AMBER}>
          {id.replace(/\D/g, "") || "?"}
        </text>
      </svg>
    );
  }
  if (id === "bandes") {
    return (
      <svg viewBox="0 0 64 40" aria-hidden className={className}>
        <rect x="4" y="5" width="56" height="30" rx="3" {...stroke} />
        <circle cx="20" cy="19" r="5" {...stroke} />
        <circle cx="44" cy="19" r="5" {...stroke} />
        <path d="M14 35l4-7h28l4 7" {...stroke} />
      </svg>
    );
  }
  if (id === "seringues") {
    return (
      <svg viewBox="0 0 64 40" aria-hidden className={className}>
        <path d="M8 32l6-6M14 26l24-24M38 2l6 6M44 8L20 32l-6-6" {...stroke} />
        <path d="M30 10l6 6M24 16l3 3M19 21l3 3" {...stroke} />
        <path d="M26 38l6-6M32 32l24-24" {...stroke} opacity=".55" />
      </svg>
    );
  }
  if (id === "pistolet") {
    return (
      <svg viewBox="0 0 64 40" aria-hidden className={className}>
        <path d="M6 10h44a4 4 0 0 1 4 4v4H30l-4 18h-10l4-18H6z" {...stroke} />
        <circle cx="54" cy="16" r="3" fill="#ff6b3e" />
      </svg>
    );
  }
  return <KeyIcon className={className} />;
}

/**
 * The group's things, bottom right (V1.4 §4): everything the village found. The pistol with its holder's
 * name (it's public); the secret things (tapes, syringes) always « porteur inconnu »; used up: greyed.
 */
export function Inventory({ items }: { items: { id: string; name: string; who?: string | null; used?: boolean }[] }) {
  const slots = Math.max(6, Math.ceil(items.length / 3) * 3);
  return (
    <div className="pj-inv" aria-label="Objets du groupe">
      <p>OBJETS DU GROUPE</p>
      <div>
        {Array.from({ length: slots }, (_, i) => {
          const it = items[i];
          return (
            <span key={i} className={it ? `full ${it.used ? "used" : ""}` : ""} data-slot={it?.id}>
              {it ? (
                <>
                  <ObjectIcon id={it.id} />
                  <b>{it.name.toUpperCase()}</b>
                  {it.who !== undefined && <i>{it.who ? it.who.toUpperCase() : "PORTEUR INCONNU"}</i>}
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

/** A thing that leaves its hiding place for the group's slots (or the slots for a lock), in its own drawing. */
export function FlyingKey({ to, object = "cle" }: { to: "slot" | "lock"; object?: string }) {
  return (
    <div className={`pj-flykey ${to === "slot" ? "to-slot" : "to-lock"}`} aria-hidden>
      <ObjectIcon id={object} />
    </div>
  );
}

/**
 * A piece of furniture close up, as the players search it: the gestures done (the keyboard lifted, the
 * mouse moved, a drawer, a box opened), and what was found there — a line of story, or the thing that
 * then flies to the group's slots; the post-it with its hint.
 */
export function PropScene({ prop, gestures, opened, hint }: { prop: string; gestures: string[]; opened: Record<string, { contenu: string; objet: string | null }>; hint: string | null }) {
  const on = (g: string) => gestures.includes(`${prop}.${g}`);
  const p = PROPS.find((x) => x.id === prop);
  if (!p) return null;
  const found = (g: string) => opened[`${prop}.${g}`];
  const story = (g: string) => found(g) && !found(g)!.objet ? found(g)!.contenu.replace(/ \((histoire|faille)\)$/, "") : null;

  if (prop === "ordi") {
    const kb = on("clavier");
    const ms = on("souris");
    const postit = found("souris")?.objet === "postit_mdp" || found("clavier")?.objet === "postit_mdp";
    return (
      <div className="pj-scene">
        <svg viewBox="0 0 800 450" role="img" aria-label={p.name}>
          <rect x="0" y="330" width="800" height="120" fill="#0d1820" />
          <line x1="0" y1="330" x2="800" y2="330" stroke="#24394a" strokeWidth="3" />
          <rect x="250" y="40" width="300" height="220" rx="14" fill="#1a2630" stroke="#3f6f88" strokeWidth="4" />
          <rect x="272" y="62" width="256" height="176" rx="8" fill="#130d03" />
          <text x="290" y="100" fontFamily="var(--scn-font-vt)" fontSize="20" fill={AMBER}>
            NORDATA  BIOS v1.04
          </text>
          <text x="290" y="128" fontFamily="var(--scn-font-vt)" fontSize="20" fill={AMBER}>
            C:\&gt; _
          </text>
          <rect x="370" y="260" width="60" height="50" fill="#1a2630" />
          <rect x="320" y="305" width="160" height="22" rx="4" fill="#1a2630" stroke="#3f6f88" strokeWidth="3" />
          {kb && story("clavier") && (
            <text x="335" y="390" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="20" fill="#8fa6b6">
              {story("clavier")}
            </text>
          )}
          <g style={{ transition: "transform .6s cubic-bezier(.4,0,.2,1)", transform: kb ? "translate(0px,-70px) rotate(-8deg)" : "none", transformOrigin: "330px 375px" }}>
            <rect x="170" y="350" width="330" height="62" rx="8" fill="#22313c" stroke="#3f6f88" strokeWidth="3" />
            {Array.from({ length: 39 }, (_, i) => (
              <rect key={i} x={182 + (i % 13) * 24} y={358 + Math.floor(i / 13) * 17} width="19" height="12" rx="2" fill="#2f4352" />
            ))}
          </g>
          {ms && postit && (
            <g transform="rotate(-4 640 395)">
              <rect x="540" y="345" width="220" height="96" fill="#f3e27a" />
              <foreignObject x="548" y="350" width="204" height="88">
                <p style={{ fontFamily: "var(--scn-font-vt)", fontSize: 17, lineHeight: 1.1, color: "#3a3210", margin: 0 }}>{hint ?? "…"}</p>
              </foreignObject>
            </g>
          )}
          <g style={{ transition: "transform .5s ease", transform: ms ? "translate(-150px,-30px)" : "none" }}>
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

  // A drawer, a box, a locker, a body: something that opens, and what lies inside.
  const g = p.gestures[0]!;
  const isOpen = on(g.id);
  const label = p.name.replace(/^L'|^Le |^La |^Les /, "").toUpperCase();
  const what = found(g.id);
  return (
    <div className="pj-scene">
      <svg viewBox="0 0 800 450" role="img" aria-label={p.name}>
        <rect x="0" y="330" width="800" height="120" fill="#0d1820" />
        <rect x="200" y="140" width="400" height="200" rx="10" fill="#1a2630" stroke="#3f6f88" strokeWidth="4" />
        <rect x="250" y={isOpen ? 250 : 230} width="300" height={isOpen ? 110 : 80} rx="6" fill="#22313c" stroke="#3f6f88" strokeWidth="3" style={{ transition: "all .5s ease" }} />
        <text x="400" y="110" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="34" letterSpacing="4" fill="#bfeaff">
          {label}
        </text>
      </svg>
      {isOpen && what && <p className="pj-scene-found">{what.objet ? what.contenu : what.contenu.replace(/ \((histoire|faille|objet secret)\)$/, "")}</p>}
      {isOpen && !what && <p className="pj-scene-found muted">Rien.</p>}
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
export function DoorOpening({ letter, dest, withKey, object }: { letter: string; dest: SpaceId; withKey: boolean; object?: string }) {
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
      {withKey && <FlyingKey to="lock" object={object} />}
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
