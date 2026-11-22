"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import type { PublicScenario } from "@/modules/loups/scenarios/types";
import { blocks, fromPhrase, inline, pickVariant, resolveTexts, suggestTexts, textVars, type ReadText } from "@/modules/loups/scenarios/texts";

const SIZE_KEY = "scn-reader-size";
const SIZES = [17, 19, 21, 24, 28, 32, 38];

const readSize = () => {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY));
    return SIZES.includes(n) ? n : 21;
  } catch {
    return 21;
  }
};

/** The texts in force on this phone: the evening's file and its hand edits, loaded with the console. */
export function useTexts(view: ConsoleView): ReadText[] {
  return useMemo(() => resolveTexts(view.setup.texts?.imported, view.setup.texts?.edited), [view.setup.texts]);
}

/**
 * The text to read aloud, full screen on the phone, in the dark. Opening or closing it changes nothing
 * in the evening and writes nothing in the journal; the projection never sees it. The command bar
 * stays above it.
 */
export function Reader({ def, view, start, onClose }: { def: PublicScenario; view: ConsoleView; start?: string; onClose: () => void }) {
  const texts = useTexts(view);
  const s = view.state;
  const suggestion = useMemo(() => suggestTexts(def, view.setup, s), [def, view.setup, s]);
  const [list, setList] = useState(start ? [start] : suggestion.ids);
  const [index, setIndex] = useState(start ? 0 : suggestion.at);
  const [browsing, setBrowsing] = useState(!start && suggestion.ids.length === 0);
  const [query, setQuery] = useState("");
  const [size, setSize] = useState(readSize);
  const scroller = useRef<HTMLDivElement>(null);

  // The screen stays awake while a text is open (silently, where the browser allows it).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (gone) void l.release();
          else lock = l;
        })
        .catch(() => undefined);
    void take();
    const again = () => document.visibilityState === "visible" && void take();
    document.addEventListener("visibilitychange", again);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const zoom = (d: number) => {
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(size) + d))]!;
    setSize(next);
    try {
      localStorage.setItem(SIZE_KEY, String(next));
    } catch {
      // Private window: the size is kept for this time only.
    }
  };
  const open = (ids: string[], at: number) => {
    setList(ids);
    setIndex(at);
    setBrowsing(false);
    scroller.current?.scrollTo({ top: 0 });
  };

  // A swipe down from the top of the text closes it.
  const touch = useRef<number | null>(null);
  const id = list[index];
  const text = texts.find((t) => t.id === id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Texte à lire"
      className="fixed inset-x-0 top-0 bottom-[4.75rem] z-[60] flex flex-col bg-black text-[#eef4f8]"
      onTouchStart={(e) => (touch.current = (scroller.current?.scrollTop ?? 0) <= 0 ? e.touches[0]!.clientY : null)}
      onTouchEnd={(e) => {
        if (touch.current !== null && e.changedTouches[0]!.clientY - touch.current > 140) onClose();
        touch.current = null;
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-[#1d2a33] px-2 py-1.5">
        <button type="button" className="scn-btn min-h-10 px-3 text-xs" onClick={() => zoom(-1)} aria-label="Texte plus petit">
          A−
        </button>
        <button type="button" className="scn-btn min-h-10 px-3 text-xs" onClick={() => zoom(1)} aria-label="Texte plus grand">
          A+
        </button>
        <button type="button" className={`scn-btn min-h-10 flex-1 px-2 text-xs ${browsing ? "scn-btn-on" : ""}`} onClick={() => setBrowsing(!browsing)}>
          Tous les textes
        </button>
        <button type="button" className="scn-btn scn-btn-primary min-h-10 px-4 text-sm" onClick={onClose}>
          Masquer
        </button>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {browsing ? (
          <AllTexts
            texts={texts}
            query={query}
            setQuery={setQuery}
            onPick={(pick) => {
              const at = suggestion.ids.indexOf(pick);
              if (at >= 0) open(suggestion.ids, at);
              else open([pick], 0);
            }}
          />
        ) : !id ? (
          <p className="text-[var(--scn-muted)]">La console ne sait pas quel texte lire maintenant : choisis-le dans « Tous les textes ».</p>
        ) : !text ? (
          <p className="scn-vt text-2xl text-[var(--scn-amber)]">Texte à écrire : {id}</p>
        ) : (
          <Text text={text} view={view} size={size} />
        )}
      </div>

      {!browsing && list.length > 1 && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[#1d2a33] px-2 py-1.5">
          <button type="button" className="scn-btn min-h-11 text-xs" disabled={index === 0} onClick={() => open(list, index - 1)}>
            ← Précédent{index > 0 && <small>{list[index - 1]}</small>}
          </button>
          <span className="text-xs text-[var(--scn-muted)] tabular-nums">
            {index + 1} / {list.length}
          </span>
          <button type="button" className="scn-btn min-h-11 text-xs" disabled={index >= list.length - 1} onClick={() => open(list, index + 1)}>
            Suivant →{index < list.length - 1 && <small>{list[index + 1]}</small>}
          </button>
        </div>
      )}
    </div>
  );
}

function Text({ text, view, size }: { text: ReadText; view: ConsoleView; size: number }) {
  const s = view.state;
  const vars = textVars(s, text.id);
  // Night 1: NUIT-13 is read from « La bête a besoin d'une meute » on.
  const body = text.id === "NUIT-13" && s.phase === "night" && s.round === 1 ? fromPhrase(text.texte, "La bête a besoin d'une meute") : text.texte;
  const parts = blocks(body);
  const labels = parts.filter((b) => b.kind === "variant").map((b) => b.label!);
  const shot = s.lastShot;
  const chosen = pickVariant(text.id, labels, { night: s.round, targetInfected: text.id === "JOUR-15" && shot ? shot.infected : null, volunteers: null });
  return (
    <article className="flex flex-col gap-4" style={{ fontSize: size, lineHeight: 1.5 }}>
      <header>
        <p className="text-[0.55em] tracking-[0.2em] text-[var(--scn-muted)]">
          {text.id} · {text.partie}
        </p>
        <h2 className="scn-vt text-[1.3em] leading-tight text-[var(--scn-ice)]">{text.titre}</h2>
        {text.quand && (
          <details className="mt-1 text-[0.6em] text-[var(--scn-amber)]">
            <summary className="cursor-pointer truncate">{text.quand}</summary>
            <p>{text.quand}</p>
          </details>
        )}
      </header>
      {parts.map((b, i) => {
        if (b.kind === "variant" && chosen && b.label !== chosen) return null;
        if (b.kind === "stage")
          return (
            <p key={i} className="text-[0.62em] text-[var(--scn-amber)] italic">
              <Inline text={b.text} vars={vars} />
            </p>
          );
        return (
          <div key={i}>
            {b.kind === "variant" && <p className="text-[0.6em] tracking-[0.1em] text-[var(--scn-amber)] uppercase">{b.label}</p>}
            <p className="font-sans">
              <Inline text={b.text} vars={vars} />
            </p>
          </div>
        );
      })}
    </article>
  );
}

function Inline({ text, vars }: { text: string; vars: Record<string, string | null> }) {
  return (
    <>
      {inline(text, vars).map((p, i) =>
        p.kind === "var" ? (
          <mark key={i} className="rounded bg-[rgba(127,216,255,.18)] px-0.5 text-[#e8f8ff]">
            {p.text}
          </mark>
        ) : p.kind === "unknown" ? (
          <span key={i} className="text-[var(--scn-muted)]">
            {p.text}
          </span>
        ) : p.kind === "choice" ? (
          <span key={i} className="text-[var(--scn-amber)]">
            {p.text}
          </span>
        ) : p.kind === "bold" ? (
          <b key={i}>{p.text}</b>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function AllTexts({ texts, query, setQuery, onPick }: { texts: ReadText[]; query: string; setQuery: (q: string) => void; onPick: (id: string) => void }) {
  const q = query.trim().toLowerCase();
  const shown = texts.filter((t) => !q || t.id.toLowerCase().includes(q) || t.titre.toLowerCase().includes(q));
  const parts = [...new Set(shown.map((t) => t.partie))];
  return (
    <div className="flex flex-col gap-3">
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher : NUIT-13, chef, réveil…" aria-label="Chercher un texte" className="scn-field" />
      {parts.map((part) => (
        <div key={part}>
          <p className="scn-head mb-1">{part.toUpperCase() || "—"}</p>
          <ul className="flex flex-col gap-1">
            {shown
              .filter((t) => t.partie === part)
              .map((t) => (
                <li key={t.id}>
                  <button type="button" className="scn-btn w-full text-left text-sm" onClick={() => onPick(t.id)}>
                    <span className="text-[var(--scn-muted)]">{t.id}</span> {t.titre}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** When a fault goes off: FAILLE-01, small, above the command bar, without hiding the console. */
export function FaultHint({ view, onRead }: { view: ConsoleView; onRead: () => void }) {
  const texts = useTexts(view);
  const count = view.state.faults.length;
  const [seen, setSeen] = useState(count);
  if (count <= seen) return null;
  const t = texts.find((x) => x.id === "FAILLE-01");
  const first = t ? blocks(t.texte).find((b) => b.kind === "read")?.text : null;
  return (
    <div className="fixed inset-x-2 bottom-[5.25rem] z-[65] mx-auto flex max-w-lg items-start gap-2 rounded-xl border border-[var(--scn-magenta)] bg-[rgba(12,18,24,.97)] p-2 text-xs">
      <p className="min-w-0 flex-1">
        <span className="text-[var(--scn-magenta)]">FAILLE-01</span> {first ? `« ${first} »` : "Texte à écrire : FAILLE-01"}
      </p>
      <button
        type="button"
        className="scn-btn min-h-9 px-2 text-xs"
        onClick={() => {
          setSeen(count);
          onRead();
        }}
      >
        Lire
      </button>
      <button type="button" className="scn-btn min-h-9 px-2 text-xs" aria-label="Fermer" onClick={() => setSeen(count)}>
        ✕
      </button>
    </div>
  );
}
