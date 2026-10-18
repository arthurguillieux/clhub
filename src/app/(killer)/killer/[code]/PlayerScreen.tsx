"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerGameView, PublicGameView } from "@/modules/killer/views";
import { Embers } from "../Embers";
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

/** Downscales the camera picture on the phone before sending it (a few hundred KB instead of several MB). */
async function shrinkPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob ?? file;
  } catch {
    return file; // the server re-encodes whatever it gets
  } finally {
    URL.revokeObjectURL(url);
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
      <Embers density={35} />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">{children}</div>
    </main>
  );
}

function Centered({ title, text }: { title: string; text: string }) {
  return (
    <div className="m-auto text-center">
      {title && <h1 className="killer-title text-3xl">{title}</h1>}
      <p className="mt-3 text-[var(--k-ash)]">{text}</p>
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
      <h1 className="killer-title killer-flicker mt-2 text-center text-4xl">Qui es-tu, tribut ?</h1>
      {view.status === "ended" ? (
        <Centered title="" text="Cette partie est terminée." />
      ) : free.length === 0 ? (
        <Centered title="" text="Tous les tributs sont inscrits. Si ton prénom n'apparaît pas, va voir l'organisateur." />
      ) : (
        <>
          <p className="mt-3 text-center text-sm text-[var(--k-ash)]">Touche ton prénom.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {free.map((t) => (
              <button key={t.id} type="button" className="killer-btn-ghost min-h-14 px-3 text-lg" onClick={() => setChoice({ id: t.id, name: t.name })}>
                {t.name}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="mt-4 text-center text-sm text-[var(--k-blood)]">{error}</p>}
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

function PhotoScreen({ code, token, name, onDone }: { code: string; token: string; name: string; onDone?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const small = await shrinkPhoto(file);
    setBlob(small);
    setPreview(URL.createObjectURL(small));
  }

  async function upload() {
    if (!blob) return;
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
      <h1 className="killer-title mt-2 text-center text-3xl">Ton portrait</h1>
      <p className="mt-3 text-center text-sm text-[var(--k-ash)]">Il apparaîtra sur le grand écran, tout le long des jeux.</p>
      <div className="mx-auto mt-8 w-56">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview before upload
          <img src={preview} alt="Ton portrait" className="killer-portrait aspect-square w-full rounded-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="killer-portrait flex aspect-square w-full flex-col items-center justify-center rounded-full bg-black/40 text-[var(--k-gold)]"
          >
            <span className="text-5xl">📸</span>
            <span className="mt-2 text-sm">Prendre ma photo</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      <div className="mt-8 flex flex-col gap-3">
        {preview && (
          <>
            <button type="button" className="killer-btn min-h-14 px-4 text-lg" disabled={busy} onClick={() => void upload()}>
              {busy ? "Envoi…" : "C'est moi, j'entre dans l'arène"}
            </button>
            <button type="button" className="killer-btn-ghost min-h-12 px-4" disabled={busy} onClick={() => input.current?.click()}>
              Reprendre la photo
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-4 text-center text-sm text-[var(--k-blood)]">{error}</p>}
    </Shell>
  );
}

// ───────── Partie ─────────

function GameScreen({ code, view, token }: { code: string; view: PlayerGameView; token: string }) {
  const { me } = view;
  const [revealed, setRevealed] = useState(false);
  const [retakePhoto, setRetakePhoto] = useState(false);
  const [seenTarget, setSeenTarget] = useState<string | null>(() => (typeof window === "undefined" ? null : readStorage(seenTargetKey(code))));
  const isNewTarget = !!me.target && seenTarget !== null && seenTarget !== me.target.id;

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
        <p className="ml-auto text-right text-sm text-[var(--k-ash)]">
          <span className="killer-title block text-2xl">{view.aliveCount}</span>en vie
        </p>
      </header>

      {view.status === "lobby" && (
        <div className="m-auto text-center">
          <h1 className="killer-title killer-flicker text-3xl">Tu es dans l&apos;arène</h1>
          <p className="mt-3 text-[var(--k-ash)]">Les jeux vont bientôt commencer. Garde cette page ouverte : ta cible et ta mission s&apos;afficheront ici.</p>
          <button type="button" className="killer-btn-ghost mt-8 min-h-12 px-4" onClick={() => setRetakePhoto(true)}>
            Reprendre ma photo
          </button>
        </div>
      )}

      {view.status === "running" && !me.alive && (
        <div className="m-auto text-center">
          <h1 className="killer-title text-4xl">Tu es tombé·e</h1>
          <p className="mt-3 text-[var(--k-ash)]">Ton chasseur a hérité de ta cible. Profite du spectacle — et pas un mot !</p>
        </div>
      )}

      {view.status === "running" && me.alive && me.target && (
        <div className="mt-10 flex flex-1 flex-col">
          {isNewTarget && !revealed && (
            <p className="killer-panel killer-rise mb-4 p-3 text-center text-sm">
              🔥 <b>Nouvelle cible.</b> Ta proie précédente est tombée : tu reprends sa chasse.
            </p>
          )}
          {!revealed ? (
            <button type="button" onClick={reveal} className="killer-panel m-auto flex w-full flex-col items-center gap-2 px-4 py-12">
              <span className="text-5xl">🎯</span>
              <span className="text-lg font-bold">Voir ma cible</span>
              <span className="text-xs text-[var(--k-ash)]">Assure-toi que personne ne regarde ton écran.</span>
            </button>
          ) : (
            <div className="killer-rise flex flex-col items-center text-center">
              <p className="killer-label">Ta cible</p>
              <TributePhoto code={code} id={me.target.id} name={me.target.name} photoVersion={me.target.photoVersion} className="mt-3 w-44" />
              <p className="killer-title mt-4 text-4xl">{me.target.name}</p>
              <div className="killer-panel mt-6 w-full p-4 text-left">
                <p className="killer-label">Ta mission</p>
                <p className="mt-2 text-lg leading-snug whitespace-pre-wrap">{me.mission}</p>
              </div>
              <p className="mt-4 text-xs text-[var(--k-ash)]">Mission accomplie ? Va voir l&apos;organisateur, discrètement.</p>
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
          <h1 className="killer-title mt-2 text-4xl">{view.stats?.winner ? `${view.stats.winner.name} l'emporte` : "Les jeux sont finis"}</h1>
          <p className="mt-3 text-[var(--k-ash)]">Regarde le grand écran.</p>
        </div>
      )}
    </Shell>
  );
}
