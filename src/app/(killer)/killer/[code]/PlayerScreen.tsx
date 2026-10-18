"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerGameView, PublicGameView } from "@/modules/killer/views";
import { Particles } from "../Particles";
import { KillerDialog } from "../KillerDialog";
import { TributePhoto } from "../TributePhoto";
import { useLongPoll } from "../useLongPoll";

const tokenKey = (code: string) => `clhub:killer:${code}`;
const seenTargetKey = (code: string) => `clhub:killer:${code}:seen-target`;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode: the organizer can always free the seat.
  }
}

export function PlayerScreen({ code }: { code: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists in the browser
    setToken(readStorage(tokenKey(code)));
    setHydrated(true);
  }, [code]);

  const path = !hydrated ? null : token ? `/api/killer/${code}/poll?token=${encodeURIComponent(token)}` : `/api/killer/${code}/poll`;
  const { data, gone, lost } = useLongPoll<PublicGameView | PlayerGameView>(path);

  // The organizer freed this seat (or the game was reset): back to the name list.
  if (lost && token) {
    writeStorage(tokenKey(code), null);
    setToken(null);
  }

  if (gone) return <Shell><Centered title="Partie introuvable" text="Cette partie n'existe plus." /></Shell>;
  if (!data) return <Shell><Centered title="" text="Connexion…" /></Shell>;

  const me = token && "me" in data ? data.me : null;
  if (!token || !me) {
    return (
      <JoinScreen
        code={code}
        view={data}
        onJoined={(t) => {
          writeStorage(tokenKey(code), t);
          setToken(t);
        }}
      />
    );
  }
  if (!me.hasPhoto) return <PhotoScreen code={code} token={token} name={me.name} />;
  return <GameScreen code={code} view={data as PlayerGameView} token={token} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="killer relative min-h-dvh overflow-hidden">
      <Particles density={35} />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">{children}</div>
    </main>
  );
}

function Centered({ title, text }: { title: string; text: string }) {
  return (
    <div className="m-auto text-center">
      {title && <h1 className="killer-title text-3xl">{title}</h1>}
      <p className="mt-3 text-[var(--k-muted)]">{text}</p>
    </div>
  );
}

// ───────── Inscription ─────────

function JoinScreen({ code, view, onJoined }: { code: string; view: PublicGameView; onJoined: (token: string) => void }) {
  const [choice, setChoice] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const free = view.tributes.filter((t) => !t.joined && t.alive);

  async function join(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/killer/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: id }),
      });
      const body = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !body.token) return setError(body.error ?? "Erreur");
      onJoined(body.token);
    } catch {
      setError("Pas de connexion — réessaie.");
    }
  }

  return (
    <Shell>
      <p className="killer-label text-center">{view.title}</p>
      <h1 className="killer-title mt-2 text-center text-3xl">Qui es-tu, tribut ?</h1>
      {view.status === "ended" ? (
        <Centered title="" text="Cette partie est terminée." />
      ) : free.length === 0 ? (
        <Centered title="" text="Tous les tributs sont inscrits. Si ton prénom n'apparaît pas, va voir l'organisateur." />
      ) : (
        <>
          <p className="mt-3 text-center text-sm text-[var(--k-muted)]">Touche ton prénom.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {free.map((t) => (
              <button key={t.id} type="button" className="killer-btn-ghost min-h-14 px-3 text-lg" onClick={() => setChoice({ id: t.id, name: t.name })}>
                {t.name}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="mt-4 text-center text-sm text-[var(--k-alert)]">{error}</p>}
      {choice && (
        <KillerDialog
          title={`Tu es bien ${choice.name} ?`}
          detail="Ton téléphone sera lié à ce prénom pour toute la partie."
          confirmLabel={`Oui, je suis ${choice.name}`}
          cancelLabel="Non, revenir à la liste"
          onConfirm={() => void join(choice.id)}
          onClose={() => setChoice(null)}
        />
      )}
    </Shell>
  );
}

// ───────── Photo ─────────

const CROP_OUTPUT = 640;

function PhotoScreen({ code, token, name, onDone }: { code: string; token: string; name: string; onDone?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );

  function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setSource(URL.createObjectURL(file));
  }

  async function upload(blob: Blob) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/killer/${code}/photo?token=${encodeURIComponent(token)}`, { method: "POST", body: blob });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "La photo n'est pas passée — réessaie.");
        return;
      }
      onDone?.();
    } catch {
      setError("Pas de connexion — réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <p className="killer-label text-center">Tribut {name}</p>
      <h1 className="killer-title mt-2 text-center text-2xl">Ton portrait</h1>
      <p className="mt-3 text-center text-sm text-[var(--k-muted)]">
        {source ? "Fais glisser la photo et zoome pour bien te placer dans le cercle." : "Il apparaîtra sur le grand écran, tout le long des jeux."}
      </p>
      {source ? (
        <Cropper key={source} src={source} busy={busy} onConfirm={(blob) => void upload(blob)} onRetake={() => input.current?.click()} />
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="killer-portrait mx-auto mt-8 flex aspect-square w-56 flex-col items-center justify-center rounded-full bg-[var(--k-surface-strong)] text-[var(--k-accent)]"
        >
          <span className="text-5xl">📸</span>
          <span className="mt-2 text-sm font-semibold">Prendre ma photo</span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-4 text-center text-sm text-[var(--k-alert)]">{error}</p>}
    </Shell>
  );
}

/**
 * Framing step: the picture fills a circle, the guest drags it and zooms with the slider (or two
 * fingers); what's inside the circle is what the TV shows. The crop is drawn on the phone, so the
 * server receives a square and only resizes it.
 */
function Cropper({ src, busy, onConfirm, onRetake }: { src: string; busy: boolean; onConfirm: (blob: Blob) => void; onRetake: () => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frameSize, setFrameSize] = useState(256);
  const [zoom, setZoom] = useState(1);
  // Picture centre relative to the circle's centre, in screen pixels.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);

  useEffect(() => {
    const update = () => {
      if (frame.current) setFrameSize(frame.current.offsetWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // The scale at which the picture just covers the circle, times the guest's zoom.
  const cover = img ? frameSize / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const sizeAt = (z: number) => ({ w: img ? img.naturalWidth * cover * z : frameSize, h: img ? img.naturalHeight * cover * z : frameSize });
  const clampAt = (o: { x: number; y: number }, z: number) => {
    const { w, h } = sizeAt(z);
    return {
      x: Math.max(-(w - frameSize) / 2, Math.min((w - frameSize) / 2, o.x)),
      y: Math.max(-(h - frameSize) / 2, Math.min((h - frameSize) / 2, o.y)),
    };
  };
  const { w: width, h: height } = sizeAt(zoom);
  const pos = clampAt(offset, zoom);

  const zoomTo = (z: number) => {
    const next = Math.max(1, Math.min(4, z));
    setOffset(clampAt({ x: (pos.x * next) / zoom, y: (pos.y * next) / zoom }, next));
    setZoom(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      zoomTo((pinch.current.zoom * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / pinch.current.distance);
    } else if (pointers.current.size === 1) {
      setOffset(clampAt({ x: pos.x + e.clientX - prev.x, y: pos.y + e.clientY - prev.y }, zoom));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  async function confirm() {
    if (!img) return;
    const scale = cover * zoom;
    const side = frameSize / scale; // the circle's side, in picture pixels
    const sx = img.naturalWidth / 2 - (frameSize / 2 + pos.x) / scale;
    const sy = img.naturalHeight / 2 - (frameSize / 2 + pos.y) / scale;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = CROP_OUTPUT;
    canvas.getContext("2d")?.drawImage(img, sx, sy, side, side, 0, 0, CROP_OUTPUT, CROP_OUTPUT);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (blob) onConfirm(blob);
  }

  return (
    <div className="mt-6 flex flex-col items-center">
      <div
        ref={frame}
        data-testid="killer-cropper"
        className="killer-portrait relative aspect-square w-64 cursor-grab touch-none overflow-hidden rounded-full bg-[var(--k-surface-strong)] select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of the camera picture
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={{ width, height, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
          />
        )}
      </div>
      <label className="mt-5 flex w-64 items-center gap-3 text-sm text-[var(--k-muted)]">
        <span aria-hidden="true">−</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          aria-label="Zoom"
          className="killer-range flex-1"
        />
        <span aria-hidden="true">+</span>
      </label>
      <div className="mt-6 flex w-full flex-col gap-3">
        <button type="button" className="killer-btn min-h-14 px-4 text-lg" disabled={busy || !img} onClick={() => void confirm()}>
          {busy ? "Envoi…" : "C'est moi, j'entre dans l'arène"}
        </button>
        <button type="button" className="killer-btn-ghost min-h-12 px-4" disabled={busy} onClick={onRetake}>
          Reprendre la photo
        </button>
      </div>
    </div>
  );
}

// ───────── Partie ─────────

function GameScreen({ code, view, token }: { code: string; view: PlayerGameView; token: string }) {
  const { me } = view;
  const [revealed, setRevealed] = useState(false);
  const [retakePhoto, setRetakePhoto] = useState(false);
  const [seenTarget, setSeenTarget] = useState<string | null>(() => (typeof window === "undefined" ? null : readStorage(seenTargetKey(code))));
  const isNewTarget = !!me.target && seenTarget !== null && seenTarget !== me.target.id;

  // Back in preparation (the organizer reset the game): the next target won't be a "new" one.
  if (view.status === "lobby" && seenTarget !== null) {
    writeStorage(seenTargetKey(code), null);
    setSeenTarget(null);
  }

  if (retakePhoto) return <PhotoScreen code={code} token={token} name={me.name} onDone={() => setRetakePhoto(false)} />;

  const reveal = () => {
    setRevealed(true);
    if (me.target) {
      writeStorage(seenTargetKey(code), me.target.id);
      setSeenTarget(me.target.id);
    }
  };

  return (
    <Shell>
      <header className="flex items-center gap-3">
        <TributePhoto code={code} id={me.id} name={me.name} photoVersion={view.tributes.find((t) => t.id === me.id)?.photoVersion ?? null} fallen={!me.alive} className="w-14" />
        <div>
          <p className="killer-label">Tribut</p>
          <p className="text-xl font-bold">{me.name}</p>
        </div>
        <p className="ml-auto text-right text-sm text-[var(--k-muted)]">
          <span className="killer-title block text-2xl text-[var(--k-accent)]">{view.aliveCount}</span>en vie
        </p>
      </header>

      {view.status === "lobby" && (
        <div className="m-auto text-center">
          <h1 className="killer-title text-2xl">Tu es dans l&apos;arène</h1>
          <p className="mt-3 text-[var(--k-muted)]">Les jeux vont bientôt commencer. Garde cette page ouverte : ta cible et ta mission s&apos;afficheront ici.</p>
          <button type="button" className="killer-btn-ghost mt-8 min-h-12 px-4" onClick={() => setRetakePhoto(true)}>
            Reprendre ma photo
          </button>
        </div>
      )}

      {view.status === "running" && !me.alive && (
        <div className="m-auto text-center">
          <h1 className="killer-title text-3xl">Tu es tombé·e</h1>
          <p className="mt-3 text-[var(--k-muted)]">Ton chasseur a hérité de ta cible. Profite du spectacle — et pas un mot !</p>
        </div>
      )}

      {view.status === "running" && me.alive && me.target && (
        <div className="mt-10 flex flex-1 flex-col">
          {isNewTarget && !revealed && (
            <p className="killer-panel killer-rise mb-4 p-3 text-center text-sm">
              <b>Nouvelle cible.</b> Ta proie précédente est tombée : tu reprends sa chasse.
            </p>
          )}
          {!revealed ? (
            <button type="button" onClick={reveal} className="killer-panel m-auto flex w-full flex-col items-center gap-2 px-4 py-12">
              <span className="text-5xl">🎯</span>
              <span className="text-lg font-bold">Voir ma cible</span>
              <span className="text-xs text-[var(--k-muted)]">Assure-toi que personne ne regarde ton écran.</span>
            </button>
          ) : (
            <div className="killer-rise flex flex-col items-center text-center">
              <p className="killer-label">Ta cible</p>
              <TributePhoto code={code} id={me.target.id} name={me.target.name} photoVersion={me.target.photoVersion} className="mt-3 w-44" />
              <p className="killer-title mt-4 text-3xl">{me.target.name}</p>
              <div className="killer-panel killer-frame mt-6 w-full p-4 text-left">
                <p className="killer-label">Ta mission</p>
                <p className="mt-2 text-lg leading-snug whitespace-pre-wrap">{me.mission}</p>
              </div>
              <p className="mt-4 text-xs text-[var(--k-muted)]">Mission accomplie ? Va voir l&apos;organisateur, discrètement.</p>
              <button type="button" className="killer-btn-ghost mt-6 min-h-12 px-5" onClick={() => setRevealed(false)}>
                Cacher
              </button>
            </div>
          )}
        </div>
      )}

      {view.status === "ended" && (
        <div className="m-auto text-center">
          <p className="killer-label">Fin des jeux</p>
          <h1 className="killer-title mt-2 text-3xl">{view.stats?.winner ? `${view.stats.winner.name} l'emporte` : "Les jeux sont finis"}</h1>
          <p className="mt-3 text-[var(--k-muted)]">Regarde le grand écran.</p>
        </div>
      )}
    </Shell>
  );
}
