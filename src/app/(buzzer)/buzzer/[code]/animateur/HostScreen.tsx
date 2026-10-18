"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { BuzzerView, HostAction } from "@/modules/jeux/domain/buzzer";
import { AnimalAvatar } from "../../AnimalAvatar";
import { BuzzerLogo } from "../../BuzzerLogo";
import { endGameAction, hostAction } from "../../actions";

const INK = "#08080d";
const POLL_REQUEST_TIMEOUT_MS = 30_000;

// Everything is sized in vh/vw so each screen fits the window exactly (this one gets projected) — no scrolling.
const btn =
  "rounded-xl border border-line bg-surface-raised px-[0.9em] py-[0.45em] font-semibold text-ink transition-opacity hover:border-primary disabled:opacity-40";
const btnPrimary = "glow-box-primary rounded-xl bg-primary px-[0.9em] py-[0.45em] font-bold text-primary-ink hover:opacity-90 disabled:opacity-40";
const btnDanger = "rounded-xl bg-red-500 px-[0.9em] py-[0.45em] font-bold text-white hover:opacity-90";

export function HostScreen({
  code,
  hostName,
  initialView,
  qrSvg,
  joinUrl,
}: {
  code: string;
  hostName: string;
  initialView: BuzzerView;
  qrSvg: string;
  joinUrl: string;
}) {
  const [view, setView] = useState(initialView);
  const [gone, setGone] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [manage, setManage] = useState(false);
  const [points, setPoints] = useState("1");
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [ending, startEnding] = useTransition();
  const versionRef = useRef(initialView.version);
  const lastSeqRef = useRef(initialView.buzzSeq);
  const soundOnRef = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  function beep() {
    if (!soundOnRef.current) return;
    try {
      audioRef.current ??= new AudioContext();
      const audio = audioRef.current;
      [880, 1175].forEach((frequency, i) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        gain.connect(audio.destination);
        const t = audio.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        oscillator.start(t);
        oscillator.stop(t + 0.3);
      });
    } catch {
      // No audio available: the screen change alone has to do.
    }
  }

  /** Both the poll loop and the actions' replies land here — the version check keeps stale snapshots out. */
  function receive(next: BuzzerView) {
    if (next.version < versionRef.current) return;
    versionRef.current = next.version;
    if (next.buzzSeq !== lastSeqRef.current) {
      lastSeqRef.current = next.buzzSeq;
      beep();
    }
    setView(next);
    if (next.ended) setGone(true);
  }

  // Same long-poll as the phones, minus the token: the host isn't a team.
  useEffect(() => {
    let alive = true;
    let controller: AbortController | null = null;
    (async () => {
      while (alive) {
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), POLL_REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(`/api/buzzer/${code}/poll?v=${versionRef.current}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!alive) return;
          if (response.status === 404) {
            setGone(true);
            return;
          }
          receive((await response.json()) as BuzzerView);
        } catch {
          if (alive) await new Promise((resolve) => setTimeout(resolve, 1000));
        } finally {
          clearTimeout(timeout);
        }
      }
    })();
    return () => {
      alive = false;
      controller?.abort();
    };
    // `receive` only touches refs and state setters, so it's safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function send(action: HostAction) {
    setError("");
    const result = await hostAction(code, action);
    if (result.ok) receive(result.view);
    else setError(result.error);
  }

  const teamById = (id: string | null) => view.teams.find((t) => t.id === id);
  const pointsValue = Math.max(1, Math.trunc(Number(points)) || 1);

  if (gone) {
    return (
      <Screen>
        <div className="m-auto flex flex-col items-center gap-4 text-center">
          <BuzzerLogo className="h-24 w-24" />
          <h1 className="font-display text-3xl font-extrabold">Partie terminée</h1>
          <Link href="/jeux/buzzer" className={`${btnPrimary} text-lg`}>
            Retour aux jeux
          </Link>
        </div>
      </Screen>
    );
  }

  // ───────── Lobby ─────────
  if (!view.started) {
    const count = view.teams.length;
    return (
      <Screen>
        <div className="grid min-h-0 w-full max-w-[1250px] flex-1 grid-cols-1 items-center gap-[3vw] md:grid-cols-[1.1fr_1fr]">
          <section className="flex min-h-0 flex-col items-center text-center">
            <BuzzerLogo className="h-[min(21vh,22vw)] w-[min(21vh,22vw)]" />
            <h1 className="mt-[1.2vh] font-display font-extrabold" style={{ fontSize: "min(4.6vw, 7.2vh)", lineHeight: 1 }}>
              LE CL<span className="glow-text-primary text-primary">HUB</span>
            </h1>
            <span
              className="glow-box-accent mt-[1.6vh] rounded-full bg-accent px-[0.9em] py-[0.1em] font-display font-extrabold text-accent-ink"
              style={{ fontSize: "min(3vw, 5vh)" }}
            >
              Buzzer !
            </span>
            <p className="mt-[1.4vh] text-muted" style={{ fontSize: "min(1.6vw, 2.6vh)" }}>
              Partie lancée par {hostName}
            </p>
          </section>

          <section className="glow-box-primary mx-auto rounded-card border border-primary/40 bg-surface p-[1.5vh] text-center">
            <div
              className="mx-auto aspect-square rounded-xl bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
              style={{ width: "min(36vh, 34vw)" }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="mt-[1vh] font-display font-bold" style={{ fontSize: "min(1.9vw, 3vh)" }}>
              📱 Scannez pour rejoindre !
            </p>
            <p className="mt-[0.4vh] text-muted" style={{ fontSize: "min(1.3vw, 2.1vh)" }}>
              ou tapez le code <b className="font-mono tracking-widest text-ink">{code}</b>
            </p>
          </section>
        </div>

        <section className="w-full max-w-[1250px] text-center">
          <h2 className="mb-[1vh] font-display font-extrabold" style={{ fontSize: "min(2.1vw, 3.4vh)" }}>
            {count === 0 ? "En attente des équipes…" : `${count} ${count === 1 ? "équipe a rejoint" : "équipes ont rejoint"} !`}
          </h2>
          <div className="flex min-h-[7.4vh] flex-wrap items-center justify-center gap-x-[1.4vw] gap-y-[1.4vh]">
            {count === 0 ? (
              <p className="text-muted" style={{ fontSize: "min(1.4vw, 2.4vh)" }}>
                Les équipes apparaîtront ici dès qu&apos;elles auront rejoint
              </p>
            ) : (
              view.teams.map((t) => (
                <div
                  key={t.id}
                  className="buzzer-pop flex items-center gap-[0.5em] rounded-full border-2 bg-surface py-[0.15em] pr-[0.8em] pl-[0.2em] font-bold"
                  style={{ borderColor: t.color, boxShadow: `0 0 16px ${t.color}55`, fontSize: "min(1.9vw, 3vh)" }}
                >
                  <AnimalAvatar id={t.avatarId} className="h-[1.7em] w-[1.7em] shrink-0" />
                  <span>{t.name}</span>
                  <i className={`h-[0.5em] w-[0.5em] rounded-full ${t.online ? "bg-primary" : "bg-line"}`} />
                </div>
              ))
            )}
          </div>
        </section>

        <button
          type="button"
          disabled={count === 0}
          onClick={() => {
            beep();
            void send({ type: "start" });
          }}
          className={`${btnPrimary} mt-[0.4vh]`}
          style={{ fontSize: "min(2.6vw, 4.2vh)" }}
        >
          🚀 Lancer le quizz
        </button>
        <p className="h-[2.4vh] text-muted" style={{ fontSize: "min(1.2vw, 2vh)" }}>
          {error || (count === 0 ? "Il faut au moins une équipe pour commencer" : "")}
        </p>
      </Screen>
    );
  }

  // ───────── Quiz ─────────
  const winner = teamById(view.winnerId);
  const hit = view.phase === "buzzed" && winner;
  const stageStyle = hit
    ? { background: winner.color, color: INK, borderColor: winner.color, boxShadow: `0 0 60px ${winner.color}77` }
    : undefined;

  return (
    <Screen>
      <header className="flex w-full shrink-0 items-center gap-[1.4vw]">
        <BuzzerLogo className="h-[7vh] w-[7vh]" />
        <div className="flex-1 font-display font-extrabold leading-tight" style={{ fontSize: "min(2.2vw, 3.6vh)" }}>
          LE CL<span className="text-primary">HUB</span> · Buzzer
          <small className="block text-[0.6em] font-medium text-muted">
            Partie de {hostName} · code {code}
          </small>
        </div>
        <div className="flex items-center gap-[0.7vw] font-medium" style={{ fontSize: "min(1.2vw, 2.1vh)" }}>
          <label className="flex items-center gap-1.5">
            Points
            <input
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-[3.6em] rounded-lg border border-line bg-surface px-1 py-[0.25em] text-center font-semibold text-ink"
            />
          </label>
          <button type="button" className={btn} onClick={() => setSoundOn((on) => !on)}>
            {soundOn ? "🔊 Son" : "🔇 Muet"}
          </button>
          <button type="button" className={btn} onClick={() => setManage((m) => !m)} aria-pressed={manage}>
            ⚙ Gérer
          </button>
          <button
            type="button"
            className={btn}
            onClick={() =>
              setDialog({
                kind: "confirm",
                title: "Remettre les scores à 0 ?",
                detail: "Les scores de toutes les équipes repartent de zéro.",
                confirmLabel: "Remettre à 0",
                cancelLabel: "Garder les scores",
                onConfirm: () => void send({ type: "resetAll" }),
              })
            }
          >
            Scores à 0
          </button>
          <button type="button" className={btn} onClick={() => void send({ type: "lobby" })}>
            ← Accueil
          </button>
          <button
            type="button"
            className={btn}
            disabled={ending}
            onClick={() =>
              setDialog({
                kind: "confirm",
                title: "Terminer la partie ?",
                detail: "Les téléphones afficheront « Partie terminée » et le QR code ne marchera plus.",
                confirmLabel: "Terminer la partie",
                cancelLabel: "Continuer à jouer",
                danger: true,
                onConfirm: () => startEnding(() => endGameAction(code)),
              })
            }
          >
            Terminer
          </button>
        </div>
      </header>

      <section
        className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center rounded-card border p-[1.5vh_3vw] text-center transition-colors ${
          hit ? "" : view.phase === "open" ? "glow-box-primary border-primary bg-primary/10" : "border-line bg-surface"
        }`}
        style={stageStyle}
      >
        <div className="flex max-w-full items-center justify-center gap-[2.4vw]">
          {hit && <AnimalAvatar id={winner.avatarId} className="buzzer-bounce h-[min(23vh,20vw)] w-[min(23vh,20vw)] shrink-0" />}
          <div className="font-display font-extrabold break-words" style={{ fontSize: "min(8vw, 12vh)", lineHeight: 1.02 }}>
            {hit ? winner.name : view.phase === "open" ? "Buzzers ouverts !" : "Buzzers fermés"}
          </div>
        </div>
        <p className="mt-[0.6vh] font-medium" style={{ fontSize: "min(2.2vw, 3.6vh)" }}>
          {hit
            ? "a buzzé en premier !"
            : view.phase === "open"
              ? "En attente d'un buzz…"
              : view.teams.length
                ? "Lance la chanson, puis ouvre les buzzers"
                : "Aucune équipe pour l'instant"}
        </p>
        <div className="mt-[2.2vh] flex flex-wrap justify-center gap-[1.2vw]" style={{ fontSize: "min(1.9vw, 3.3vh)" }}>
          {hit ? (
            <>
              <button type="button" className={btnPrimary} onClick={() => void send({ type: "correct", points: pointsValue })}>
                ✔ Bonne réponse
              </button>
              <button type="button" className={btnDanger} onClick={() => void send({ type: "wrong" })}>
                ✘ Mauvaise réponse
              </button>
              <button type="button" className={btn} onClick={() => void send({ type: "cancel" })}>
                ↺ Annuler le buzz
              </button>
            </>
          ) : view.phase === "open" ? (
            <button type="button" className={btn} onClick={() => void send({ type: "close" })}>
              Fermer les buzzers
            </button>
          ) : (
            <button type="button" className={btnPrimary} onClick={() => void send({ type: "open" })}>
              ▶ Ouvrir les buzzers (nouvelle chanson)
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-red-400">{error}</p>}
      </section>

      {/* Compact cards (avatar · name · score, buttons underneath): up to 8 teams must leave the stage enough room. */}
      <div className="grid w-full shrink-0 grid-cols-[repeat(auto-fit,minmax(min(215px,100%),1fr))] gap-[1vw]">
        {view.teams.length === 0 && <p className="col-span-full p-[2vh] text-center text-muted">Aucune équipe pour l&apos;instant.</p>}
        {view.teams.map((t) => (
          <div
            key={t.id}
            className={`relative grid grid-cols-[auto_1fr_auto] items-center gap-x-[0.8vw] rounded-card border border-t-[1vh] border-line bg-surface px-[0.8vw] py-[0.8vh] transition-transform ${
              t.id === view.winnerId ? "-translate-y-[0.6vh]" : ""
            }`}
            style={{ borderTopColor: t.color, boxShadow: t.id === view.winnerId ? `0 0 28px ${t.color}66` : undefined }}
          >
            <AnimalAvatar id={t.avatarId} className="row-span-2 h-[min(8.5vh,5.5vw)] w-[min(8.5vh,5.5vw)]" />
            <div className="flex min-w-0 items-center gap-[0.5em] font-bold leading-tight" style={{ fontSize: "min(1.35vw, 2.4vh)" }}>
              <span
                className={`h-[0.55em] w-[0.55em] shrink-0 rounded-full ${t.online ? "bg-primary" : "bg-line"}`}
                title={t.online ? "connecté" : "déconnecté"}
              />
              <span className="line-clamp-2 flex-1 break-words">{t.name}</span>
              {t.out && <span className="rounded-md bg-ink px-2 py-0.5 text-[0.6em] font-semibold text-ground">éliminé</span>}
            </div>
            <div className="row-span-2 font-display font-extrabold leading-none" style={{ fontSize: "min(3.6vw, 7vh)", color: t.color }}>
              {t.score}
            </div>
            <div className="mt-[0.4vh] flex flex-wrap gap-1" style={{ fontSize: "min(1.05vw, 1.8vh)" }}>
              <button type="button" className={btn} onClick={() => void send({ type: "score", teamId: t.id, delta: -1 })}>
                −1
              </button>
              <button type="button" className={btn} onClick={() => void send({ type: "score", teamId: t.id, delta: 1 })}>
                +1
              </button>
              {manage && (
                <>
                  <button type="button" className={btn} onClick={() => setDialog({ kind: "rename", teamId: t.id, name: t.name })}>
                    Renommer
                  </button>
                  <button
                    type="button"
                    className={btn}
                    onClick={() =>
                      setDialog({
                        kind: "confirm",
                        title: `Retirer « ${t.name} » ?`,
                        detail: "L'équipe sort de la partie, avec son score.",
                        confirmLabel: "Retirer l'équipe",
                        cancelLabel: "Garder l'équipe",
                        danger: true,
                        onConfirm: () => void send({ type: "remove", teamId: t.id }),
                      })
                    }
                  >
                    Retirer
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* The join link stays reachable for latecomers without leaving the quiz screen. */}
      <p className="shrink-0 text-center text-muted" style={{ fontSize: "min(1.1vw, 1.8vh)" }}>
        Retardataires : {joinUrl}
      </p>

      {dialog && (
        <HostDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onRename={(teamId, name) => {
            void send({ type: "rename", teamId, name });
            setDialog(null);
          }}
        />
      )}
    </Screen>
  );
}

/** Replaces the browser's confirm()/prompt(): every button says what it does, never just "OK / Annuler". */
type Dialog =
  | {
      kind: "confirm";
      title: string;
      detail: string;
      confirmLabel: string;
      cancelLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    }
  | { kind: "rename"; teamId: string; name: string };

function HostDialog({
  dialog,
  onClose,
  onRename,
}: {
  dialog: Dialog;
  onClose: () => void;
  onRename: (teamId: string, name: string) => void;
}) {
  const [draft, setDraft] = useState(dialog.kind === "rename" ? dialog.name : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dialog.kind === "confirm" ? dialog.title : "Renommer l'équipe"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 text-base"
      onClick={onClose}
    >
      <div
        className="glow-box-primary w-full max-w-md rounded-card border border-primary/40 bg-surface-raised p-6 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {dialog.kind === "confirm" ? (
          <>
            <p className="font-display text-xl font-extrabold">{dialog.title}</p>
            <p className="mt-2 text-muted">{dialog.detail}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className={dialog.danger ? btnDanger : btnPrimary}
                onClick={() => {
                  dialog.onConfirm();
                  onClose();
                }}
              >
                {dialog.confirmLabel}
              </button>
              <button type="button" className={btn} onClick={onClose} autoFocus>
                {dialog.cancelLabel}
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) onRename(dialog.teamId, draft);
            }}
          >
            <label htmlFor="rename-team" className="font-display text-xl font-extrabold">
              Nouveau nom de l&apos;équipe
            </label>
            <input
              id="rename-team"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={24}
              autoFocus
              className="mt-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-lg text-ink focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" className={btnPrimary} disabled={!draft.trim()}>
                Renommer l&apos;équipe
              </button>
              <button type="button" className={btn} onClick={onClose}>
                Garder le nom actuel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="flex h-dvh flex-col items-center gap-[1.8vh] overflow-hidden bg-ground px-[2.4vw] py-[2vh] text-ink">{children}</main>;
}
