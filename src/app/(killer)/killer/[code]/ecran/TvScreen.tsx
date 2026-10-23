"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicGameView, PublicTribute } from "@/modules/killer/views";
import { DEFAULT_VOLUME, MAX_VOLUME, loadSample, playChime, playElimination } from "../../sounds";
import { Bubbles } from "../../Bubbles";
import { LabRoom } from "../../LabRoom";
import { TributePhoto } from "../../TributePhoto";
import { useLongPoll } from "../../useLongPoll";

const FALL_DURATION_MS = 7000;
// "-v2": the default doubled on 24/10 — a knob remembered at the old default must not hold it back.
const VOLUME_KEY = "clhub:killer:tv-volume-v2";

/**
 * Picks the column count that gives the biggest portraits while every agent fits on screen, then
 * scales them down so the lab behind keeps some room to breathe.
 */
function bestGrid(count: number, width: number, height: number, scale = 0.72): { cols: number; size: number } {
  let best = { cols: 1, size: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols++) {
    const rows = Math.ceil(count / cols);
    const size = Math.min((width / cols) * 0.78, (height / rows) * 0.66);
    if (size > best.size) best = { cols, size };
  }
  return { cols: best.cols, size: best.size * scale };
}

function useWindowSize() {
  const [size, setSize] = useState({ w: 1280, h: 720 });
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export function TvScreen({ code, initialView, qrSvg, joinUrl }: { code: string; initialView: PublicGameView; qrSvg: string; joinUrl: string }) {
  const { data, gone } = useLongPoll<PublicGameView>(`/api/killer/${code}/poll`, initialView);
  const view = data ?? initialView;
  const audio = useRef<AudioContext | null>(null);
  const sample = useRef<AudioBuffer | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  // The volume knob, remembered by this browser (the TV's laptop) from one game to the next.
  const [volume, setVolume] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(VOLUME_KEY));
      return saved > 0 && saved <= MAX_VOLUME ? saved : DEFAULT_VOLUME;
    } catch {
      return DEFAULT_VOLUME;
    }
  });
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // Private mode: the knob still works for this evening.
    }
  }, [volume]);

  // A new fall since the page opened → the cannon and the portrait. Detected by the fall's own timestamp, so a
  // reconnect or an unrelated update never replays an old one.
  const [fall, setFall] = useState<PublicGameView["lastFall"]>(null);
  const [lastSeenFallAt, setLastSeenFallAt] = useState(initialView.lastFall?.at ?? null);
  if ((view.lastFall?.at ?? null) !== lastSeenFallAt) {
    setLastSeenFallAt(view.lastFall?.at ?? null);
    // Only a fall more recent than the last one shown — an undo brings back an *older* "last fall".
    if (view.lastFall && (!lastSeenFallAt || view.lastFall.at > lastSeenFallAt)) setFall(view.lastFall);
  }

  useEffect(() => {
    if (!fall) return;
    const ctx = audio.current;
    if (ctx) void ctx.resume().then(() => playElimination(ctx, sample.current, volumeRef.current));
    const timer = setTimeout(() => setFall(null), FALL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [fall]);

  // The organizer's own sound, if they chose one: (re)loaded once the sound is on, and whenever they change it.
  const soundVersion = view.soundVersion;
  useEffect(() => {
    const ctx = audio.current;
    if (!soundOn || !ctx) return;
    if (soundVersion === null) {
      sample.current = null;
      return;
    }
    let current = true;
    void loadSample(ctx, `/api/killer/${code}/sound?v=${soundVersion}`).then((buffer) => {
      if (current) sample.current = buffer;
    });
    return () => {
      current = false;
    };
  }, [soundOn, soundVersion, code]);

  // Sound and full screen are asked for straight away, inside the click: Firefox (on a Mac at least)
  // refuses full screen once anything has been awaited — it used to come after the sound had started.
  // Each one is independent, so a refusal of one never blocks the other.
  const [soundBlocked, setSoundBlocked] = useState(false);
  const startAudio = () => {
    const ctx = (audio.current ??= new AudioContext());
    ctx.onstatechange = () => setSoundBlocked(ctx.state !== "running");
    void ctx
      .resume()
      .then(() => {
        setSoundBlocked(ctx.state !== "running");
        if (ctx.state === "running") playChime(ctx); // proof that the sound works, before the first fall
      })
      .catch(() => setSoundBlocked(true));
  };
  const enableSound = () => {
    const page = document.documentElement;
    if (!document.fullscreenElement && page.requestFullscreen) void page.requestFullscreen().catch(() => {});
    startAudio();
    setSoundOn(true);
  };

  // Bottom right: switch the sound on, unblock it if the browser held it back, then the volume and a test shot.
  const soundCorner = !soundOn ? (
    <button
      type="button"
      onClick={enableSound}
      className="killer-btn absolute right-[2vw] bottom-[2vh] z-30 px-5 py-3 text-lg"
      title="Les navigateurs n'autorisent le son qu'après un clic"
    >
      🔊 Activer le son et le plein écran
    </button>
  ) : soundBlocked ? (
    <button
      type="button"
      onClick={startAudio}
      className="killer-btn absolute right-[2vw] bottom-[2vh] z-30 px-5 py-3 text-lg"
      title="Le navigateur a bloqué le son : un clic de plus le débloque"
    >
      🔇 Son bloqué par le navigateur — cliquer pour l&apos;activer
    </button>
  ) : (
    <div className="absolute right-[1.5vw] bottom-[1.5vh] z-30 flex items-center gap-3 rounded-full bg-white/70 px-3 py-1.5 text-sm text-[var(--k-muted)] opacity-30 transition-opacity focus-within:opacity-100 hover:opacity-100">
      <label className="flex items-center gap-2">
        <span aria-hidden="true">🔉</span>
        <input
          type="range"
          min={0.5}
          max={MAX_VOLUME}
          step={0.5}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume du son d'élimination"
          className="killer-range w-28"
        />
        <span className="w-12 tabular-nums">{Math.round(volume * 100)} %</span>
      </label>
      <button
        type="button"
        onClick={() => audio.current && playElimination(audio.current, sample.current, volume)}
        className="rounded-full px-2 py-1 hover:text-[var(--k-ink)]"
        title="Faire tonner le canon pour régler le volume"
      >
        🔊 Tester le canon
      </button>
    </div>
  );

  return (
    <main className="killer relative h-dvh overflow-hidden">
      <LabRoom />
      <Bubbles />
      <div className="relative flex h-full flex-col px-[3vw] py-[3vh]">
        {gone && (
          <div className="m-auto text-center">
            <p className="killer-label" style={{ fontSize: "min(1.6vw, 2.8vh)" }}>
              Fin de transmission
            </p>
            <p className="killer-title mt-[2vh]" style={{ fontSize: "min(4.4vw, 8vh)" }}>
              Partie supprimée
            </p>
          </div>
        )}
        {!gone && view.status === "lobby" && <Lobby code={code} view={view} qrSvg={qrSvg} joinUrl={joinUrl} />}
        {!gone && view.status === "running" && <Arena code={code} view={view} />}
        {!gone && view.status === "ended" && <Wrapped code={code} view={view} />}
      </div>

      {fall && <FallOverlay key={fall.at} code={code} fall={fall} remaining={view.aliveCount} />}

      {soundCorner}
    </main>
  );
}

function Lobby({ code, view, qrSvg, joinUrl }: { code: string; view: PublicGameView; qrSvg: string; joinUrl: string }) {
  const joined = view.tributes.filter((t) => t.joined);
  const { w, h } = useWindowSize();
  const grid = bestGrid(Math.max(joined.length, 1), w * 0.6, h * 0.62);

  return (
    <div className="grid h-full grid-cols-[1fr_0.75fr] items-center gap-[4vw]">
      <section className="flex h-full min-h-0 flex-col">
        <p className="killer-label" style={{ fontSize: "min(1.4vw, 2.4vh)" }}>
          Initialisation de la simulation
        </p>
        <h1 className="killer-title killer-flicker mt-[1vh]" style={{ fontSize: "min(4.4vw, 7.5vh)", lineHeight: 1.1 }}>
          {view.title}
        </h1>
        <p className="mt-[2vh] text-[var(--k-muted)]" style={{ fontSize: "min(1.8vw, 3vh)" }}>
          {`${joined.length} agent${joined.length > 1 ? "s" : ""} connecté${joined.length > 1 ? "s" : ""} sur ${view.tributes.length}`}
        </p>
        <div className="mt-[3vh] grid min-h-0 flex-1 content-start justify-start gap-[1.5vw]" style={{ gridTemplateColumns: `repeat(${grid.cols}, ${grid.size}px)` }}>
          {joined.map((t) => (
            <figure key={t.id} className="killer-rise flex flex-col items-center">
              <TributePhoto code={code} id={t.id} name={t.name} photoVersion={t.photoVersion} className="w-full" />
              <figcaption className="mt-[0.8vh] truncate text-center font-bold" style={{ fontSize: Math.max(12, grid.size * 0.16), width: grid.size * 1.35 }}>
                {t.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="killer-panel killer-frame flex flex-col items-center p-[2.5vh]">
        <div className="aspect-square rounded-xl bg-white p-[1vh] [&>svg]:h-full [&>svg]:w-full" style={{ width: "min(30vw, 52vh)" }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="killer-title mt-[2vh] text-center" style={{ fontSize: "min(1.8vw, 3vh)" }}>
          Scanne pour rejoindre la simulation
        </p>
        <p className="mt-[1vh] text-[var(--k-muted)]" style={{ fontSize: "min(1.2vw, 2vh)" }}>
          {joinUrl.replace(/^https?:\/\//, "")}
        </p>
      </section>
    </div>
  );
}

function Arena({ code, view }: { code: string; view: PublicGameView }) {
  const { w, h } = useWindowSize();
  const grid = bestGrid(view.tributes.length, w * 0.94, h * 0.78);
  // The living first, then the fallen in the order they fell.
  const ordered = [...view.tributes].sort((a, b) => Number(b.alive) - Number(a.alive) || (a.killedAt ?? "").localeCompare(b.killedAt ?? ""));

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-end justify-between">
        <h1 className="killer-title" style={{ fontSize: "min(2.8vw, 4.8vh)", lineHeight: 1.1 }}>
          {view.title}
        </h1>
        <p className="text-right text-[var(--k-muted)]" style={{ fontSize: "min(1.6vw, 2.8vh)" }}>
          <span className="killer-title block" style={{ fontSize: "min(4.2vw, 7.5vh)", lineHeight: 1, color: "var(--k-accent)" }}>
            {view.aliveCount}
          </span>
          agent{view.aliveCount > 1 ? "s" : ""} actif{view.aliveCount > 1 ? "s" : ""}
        </p>
      </header>
      <div className="mt-[2vh] grid min-h-0 flex-1 content-center justify-center gap-x-[1.6vw] gap-y-[2vh]" style={{ gridTemplateColumns: `repeat(${grid.cols}, ${grid.size}px)` }}>
        {ordered.map((t) => (
          <Portrait key={t.id} code={code} t={t} size={grid.size} />
        ))}
      </div>
    </div>
  );
}

function Portrait({ code, t, size }: { code: string; t: PublicTribute; size: number }) {
  return (
    <figure className="relative flex flex-col items-center">
      <div className="relative w-full">
        <TributePhoto code={code} id={t.id} name={t.name} photoVersion={t.photoVersion} fallen={!t.alive} className="w-full" />
        {!t.alive && (
          <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute top-[18%] left-[18%] h-[64%] w-[64%] text-[var(--k-alert)]">
            <path d="M12 12 L88 88 M88 12 L12 88" stroke="currentColor" strokeWidth={Math.max(5, 600 / size)} strokeLinecap="round" />
          </svg>
        )}
      </div>
      <figcaption
        className={`mt-[0.6vh] truncate text-center font-bold ${t.alive ? "" : "text-[var(--k-muted)] line-through"}`}
        style={{ fontSize: Math.max(12, size * 0.16), width: size * 1.35 }}
      >
        {t.name}
      </figcaption>
    </figure>
  );
}

function FallOverlay({ code, fall, remaining }: { code: string; fall: NonNullable<PublicGameView["lastFall"]>; remaining: number }) {
  return (
    <div className="killer-fall-veil absolute inset-0 z-40 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.97),rgba(226,230,234,0.98)_70%)]">
      <div className="killer-shake flex flex-col items-center">
        <p className="killer-label" style={{ fontSize: "min(1.6vw, 2.8vh)", color: "var(--k-alert)" }}>
          Signal perdu
        </p>
        <div className="relative mt-[3vh] rounded-full shadow-[0_0_0_3px_var(--k-alert),0_0_30px_rgba(240,54,90,0.35)]" style={{ width: "min(30vw, 46vh)" }}>
          <span aria-hidden="true" className="killer-ring absolute inset-0 rounded-full" />
          <div className="killer-fall-portrait relative overflow-hidden rounded-full">
            <TributePhoto code={code} id={fall.id} name={fall.name} photoVersion={fall.photoVersion} className="w-full" />
            <span aria-hidden="true" className="killer-scan absolute inset-x-0 top-0 h-1/3" />
          </div>
        </div>
        <p className="killer-title mt-[3.5vh]" style={{ fontSize: "min(5.4vw, 9vh)", lineHeight: 1.1 }}>
          {fall.name}
        </p>
        <p className="mt-[1.5vh] text-[var(--k-muted)]" style={{ fontSize: "min(2vw, 3.4vh)" }}>
          est éliminé·e · {remaining} agent{remaining > 1 ? "s" : ""} actif{remaining > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

function Wrapped({ code, view }: { code: string; view: PublicGameView }) {
  const s = view.stats;
  const byId = new Map(view.tributes.map((t) => [t.id, t]));
  const photo = (id: string) => byId.get(id)?.photoVersion ?? null;
  if (!s) return null;

  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: "Durée de la partie", value: s.durationMinutes !== null ? formatDuration(s.durationMinutes) : "—" },
    { label: "Éliminations", value: String(s.totalKills) },
    s.fastestKill
      ? { label: "Première élimination", value: s.fastestKill.killerName, sub: `sur ${s.fastestKill.victimName}, après ${formatDuration(s.fastestKill.minutesIn)}` }
      : { label: "Première élimination", value: "—" },
    s.lastFallen ? { label: "Dernier·e éliminé·e", value: s.lastFallen.name, sub: "si près du but" } : { label: "Dernier·e éliminé·e", value: "—" },
  ];

  return (
    <div className="grid h-full grid-cols-[1fr_1.1fr] gap-[3vw]">
      <section className="flex flex-col items-center justify-center text-center">
        <p className="killer-label" style={{ fontSize: "min(1.6vw, 2.8vh)" }}>
          {s.winner ? "Dernier agent actif" : "Fin de la simulation"}
        </p>
        {s.winner && (
          <div className="killer-rise mt-[3vh]" style={{ width: "min(30vw, 46vh)" }}>
            <TributePhoto code={code} id={s.winner.id} name={s.winner.name} photoVersion={photo(s.winner.id)} className="w-full" />
          </div>
        )}
        <p className="killer-title killer-flicker mt-[3vh]" style={{ fontSize: "min(4.4vw, 8vh)", lineHeight: 1.1 }}>
          {s.winner?.name ?? view.title}
        </p>
      </section>
      <section className="flex min-h-0 flex-col justify-center gap-[3vh]">
        {s.podium.length > 0 && (
          <div className="killer-panel p-[2.5vh]">
            <p className="killer-label" style={{ fontSize: "min(1.2vw, 2vh)" }}>
              Le tableau de chasse
            </p>
            <ol className="mt-[1.5vh] flex flex-col gap-[1.5vh]">
              {s.podium.map((p, i) => (
                <li key={p.id} className="flex items-center gap-[1.5vw]">
                  <span className="killer-title w-[3vw] text-center" style={{ fontSize: "min(2.4vw, 4vh)", color: "var(--k-accent)" }}>
                    {i + 1}
                  </span>
                  <TributePhoto code={code} id={p.id} name={p.name} photoVersion={photo(p.id)} className="w-[min(6vw,10vh)]" />
                  <span className="flex-1 truncate font-bold" style={{ fontSize: "min(2.2vw, 3.8vh)" }}>
                    {p.name}
                  </span>
                  <span className="font-semibold text-[var(--k-accent)] tabular-nums" style={{ fontSize: "min(2vw, 3.4vh)" }}>
                    {p.kills} kill{p.kills > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="grid grid-cols-2 gap-[2vh]">
          {tiles.map((tile) => (
            <div key={tile.label} className="killer-panel p-[2vh]">
              <p className="killer-label" style={{ fontSize: "min(1vw, 1.8vh)" }}>
                {tile.label}
              </p>
              <p className="mt-[0.8vh] truncate font-bold" style={{ fontSize: "min(2.6vw, 4.4vh)" }}>
                {tile.value}
              </p>
              {tile.sub && (
                <p className="truncate text-[var(--k-muted)]" style={{ fontSize: "min(1.1vw, 2vh)" }}>
                  {tile.sub}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
