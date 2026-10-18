"use client";

import { useEffect, useRef, useState } from "react";
import { AVATARS } from "@/modules/jeux/domain/avatars";
import type { BuzzerView } from "@/modules/jeux/domain/buzzer";
import { AnimalAvatar } from "../AnimalAvatar";
import { BuzzerLogo } from "../BuzzerLogo";

interface Me {
  token: string;
  teamId: string;
}

const storageKey = (code: string) => `clhub:buzzer:${code}`;
const INK = "#08080d";
const POLL_REQUEST_TIMEOUT_MS = 30_000;
/** No answer for this long = the connection is dead (sleeping phone, lost network): start a fresh poll. */
const STALE_AFTER_MS = 30_000;

const darken = (hex: string) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.5)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

export function PlayerBuzzer({ code }: { code: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<BuzzerView | null>(null);
  const [gone, setGone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [notice, setNotice] = useState("");
  /** Bumped to throw away the current long-poll and start a fresh one. */
  const [restartCount, setRestartCount] = useState(0);
  /** Set when a poll loop starts and on every answer; 0 = no loop running yet. */
  const lastMessageAt = useRef(0);

  // localStorage only exists in the browser, so it's read after mount — see PointCounter for the same pattern.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(code));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronising with an external system (see above)
      if (raw) setMe(JSON.parse(raw) as Me);
    } catch {
      // Blocked or corrupt storage: the player just joins again.
    }
    setHydrated(true);
  }, [code]);

  function forgetTeam() {
    try {
      window.localStorage.removeItem(storageKey(code));
    } catch {
      // nothing to clean up
    }
    setMe(null);
    setEditing(false);
  }

  // The long-poll loop: the server holds each request open until the room changes (or ~20 s), then we ask again at once.
  useEffect(() => {
    if (!hydrated || gone) return;
    let alive = true;
    let controller: AbortController | null = null;
    let version = -1;
    lastMessageAt.current = Date.now();

    (async () => {
      while (alive) {
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), POLL_REQUEST_TIMEOUT_MS);
        try {
          const query = `v=${version}${me ? `&token=${encodeURIComponent(me.token)}` : ""}`;
          const response = await fetch(`/api/buzzer/${code}/poll?${query}`, { cache: "no-store", signal: controller.signal });
          if (!alive) return;
          if (response.status === 404) {
            setGone(true);
            return;
          }
          if (response.status === 410) {
            forgetTeam(); // the host removed this team
            return;
          }
          const next = (await response.json()) as BuzzerView;
          if (!alive) return;
          version = next.version;
          lastMessageAt.current = Date.now();
          setView(next);
          setNotice("");
          if (next.ended) {
            setGone(true);
            return;
          }
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
    // forgetTeam only touches state setters and `code`, so it's safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, hydrated, gone, me, restartCount]);

  // Sleeping phone, app switch, network change: reconnect by itself.
  useEffect(() => {
    const restart = () => setRestartCount((n) => n + 1);
    const watchdog = setInterval(() => {
      if (lastMessageAt.current && Date.now() - lastMessageAt.current > STALE_AFTER_MS) restart();
    }, 4000);
    const onVisible = () => {
      if (!document.hidden) restart();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) restart();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", restart);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", restart);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Keep the screen awake while playing (the lock is dropped whenever the tab is hidden, so ask again on return).
  useEffect(() => {
    if (!me || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          lock = l;
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (!document.hidden) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [me]);

  const mine = view && me ? view.teams.find((t) => t.id === me.teamId) : undefined;
  const takenByOthers = new Set(view?.teams.filter((t) => t.id !== mine?.id).map((t) => t.avatarId));
  const firstFree = AVATARS.find((a) => !takenByOthers.has(a.id))?.id ?? null;
  const selected = pick && !takenByOthers.has(pick) ? pick : (mine?.avatarId ?? firstFree);
  const showJoin = !me || editing || (view !== null && !mine);

  async function submitJoin() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Écris un nom");
    if (!selected) return setError("Choisis un animal");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/buzzer/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, avatar: selected, token: me?.token ?? null }),
      });
      if (response.status === 404) return setGone(true);
      const body = (await response.json()) as { token?: string; teamId?: string; error?: string };
      if (!response.ok || !body.token || !body.teamId) return setError(body.error ?? "Erreur");
      const next = { token: body.token, teamId: body.teamId };
      try {
        window.localStorage.setItem(storageKey(code), JSON.stringify(next));
      } catch {
        // Without storage a reload means joining again — not worth blocking the game over.
      }
      setMe(next);
      setEditing(false);
    } catch {
      setError("Pas de connexion… réessaie");
    } finally {
      setBusy(false);
    }
  }

  async function onBuzz() {
    if (!me) return;
    setPressed(true);
    try {
      const response = await fetch(`/api/buzzer/${code}/buzz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: me.token }),
      });
      if (response.status === 410) return forgetTeam();
      if (response.status === 404) return setGone(true);
      const body = (await response.json()) as { ok: boolean };
      // Not counted (too late, buzzers closed): re-sync so the screen shows what the room really says.
      if (!body.ok) setRestartCount((n) => n + 1);
    } catch {
      setNotice("Pas de connexion… réessaie");
      setRestartCount((n) => n + 1);
    }
  }

  // ───────── Screens ─────────

  if (!hydrated) return <Shell>{null}</Shell>;

  if (gone) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <BuzzerLogo className="h-20 w-20" />
          <h1 className="font-display text-2xl font-extrabold">Partie terminée</h1>
          <p className="text-muted">Cette partie est finie ou n&apos;existe plus. Demande un nouveau QR code à l&apos;animateur.</p>
        </div>
      </Shell>
    );
  }

  if (showJoin) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-5 py-8">
          <BuzzerLogo className="h-20 w-20 shrink-0" />
          <h1 className="font-display text-3xl font-extrabold">
            Buz<span className="glow-text-primary text-primary">zer</span>
          </h1>
          <p className="text-center text-muted">{editing ? "Change ton nom ou ton animal" : "Comment s'appelle ton équipe ?"}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitJoin()}
            maxLength={24}
            placeholder="Nom de l'équipe"
            autoComplete="off"
            className="w-full max-w-sm rounded-xl border border-line bg-surface px-4 py-4 text-center text-2xl text-ink select-text focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <p className="mt-2 text-muted">Choisis l&apos;animal de ton équipe</p>
          <div className="grid w-full max-w-sm grid-cols-4 gap-2.5">
            {AVATARS.map((a) => {
              const taken = takenByOthers.has(a.id);
              const isSelected = a.id === selected;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={taken}
                  onClick={() => setPick(a.id)}
                  aria-pressed={isSelected}
                  aria-label={a.name}
                  style={isSelected ? { borderColor: a.color, boxShadow: `0 0 18px ${a.color}66` } : undefined}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-surface px-1 pt-1.5 pb-1 text-[11px] font-bold ${
                    isSelected ? "scale-105 border-transparent bg-surface-raised" : "border-line-soft"
                  } ${taken ? "opacity-25 grayscale" : ""}`}
                >
                  <AnimalAvatar id={a.id} className="aspect-square w-full" />
                  {a.name}
                  {taken && (
                    <span className="absolute inset-0 flex items-center justify-center text-3xl font-black" aria-hidden="true">
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={submitJoin}
            className="glow-box-primary mt-2 w-full max-w-sm rounded-xl bg-primary px-4 py-4 text-xl font-bold text-primary-ink disabled:opacity-50"
          >
            {editing ? "Enregistrer" : "Rejoindre"}
          </button>
          <p className="min-h-[1.2em] text-center text-red-400">{error}</p>
        </div>
      </Shell>
    );
  }

  if (!view || !mine) {
    return (
      <Shell>
        <p className="m-auto text-muted">Connexion…</p>
      </Shell>
    );
  }

  // The buzzer glows in the team's colour whenever this team could still answer, and goes dark otherwise.
  const winner = view.teams.find((t) => t.id === view.winnerId);
  let label = "";
  let message = "";
  let live = false;
  let lit = false;
  if (view.winnerId === mine.id) {
    label = "BUZZÉ !";
    message = "À toi de répondre";
    lit = true;
  } else if (view.phase === "buzzed") {
    label = "TROP TARD";
    message = `${winner?.name ?? ""} a buzzé`;
  } else if (mine.out) {
    label = "ÉLIMINÉ";
    message = "pour cette chanson";
  } else if (view.phase === "open") {
    label = "BUZZ !";
    message = "Appuie dès que tu sais";
    live = true;
    lit = true;
  } else {
    label = "ATTENDS";
    message = view.started ? "Buzzers fermés" : "La partie va bientôt commencer ✨";
  }
  const rim = lit ? darken(mine.color) : "#050505";
  const lip = pressed
    ? `0 2px 0 ${rim}, 0 4px 10px rgba(0,0,0,.5), inset 0 -8px 16px rgba(0,0,0,.3)`
    : `0 12px 0 ${rim}, 0 18px 24px rgba(0,0,0,.5), inset 0 -8px 16px rgba(0,0,0,.3)`;

  return (
    <Shell>
      <button
        type="button"
        onClick={() => {
          setName(mine.name);
          setPick(mine.avatarId);
          setError("");
          setEditing(true);
        }}
        className="flex w-full items-center justify-center gap-2.5 px-4 py-3.5 text-[22px] font-extrabold"
        style={{ background: mine.color, color: INK }}
      >
        <AnimalAvatar id={mine.avatarId} className="h-10 w-10 shrink-0 drop-shadow-[0_2px_0_rgba(0,0,0,.35)]" />
        <span className="truncate">{mine.name}</span>
      </button>

      <div className="flex flex-1 flex-col items-center justify-center gap-[4vh] bg-[radial-gradient(circle_at_50%_40%,#1a1a24,#08080d)] p-4">
        <div
          className={`relative flex items-start justify-center rounded-full bg-[#121218] ${live ? "buzzer-live" : ""}`}
          style={{
            color: mine.color,
            width: "min(74vw, 46vh)",
            height: "min(74vw, 46vh)",
            boxShadow: "0 0 0 6px #2e2e3d, 0 14px 30px rgba(0,0,0,.6)",
          }}
        >
          {/* A div, not a <button>: no native button styling to fight with. */}
          <div
            role="button"
            aria-label={label}
            onPointerDown={(e) => {
              e.preventDefault();
              if (live) navigator.vibrate?.(60);
              void onBuzz();
            }}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            className="flex h-full w-full cursor-pointer items-center justify-center rounded-full border-[6px] text-center font-display font-black"
            style={{
              fontSize: "min(10.5vw, 6vh)",
              color: lit ? INK : "#8a8a8a",
              borderColor: lit ? "rgba(255,255,255,.25)" : "#3a3a3a",
              transform: pressed ? "translateY(8px)" : "translateY(-4px)",
              transition: "transform .06s, box-shadow .06s",
              boxShadow: lip,
              background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,${lit ? 0.55 : 0.1}), rgba(255,255,255,0) 38%), radial-gradient(circle at 50% 50%, ${lit ? mine.color : "#2a2a2a"}, ${rim})`,
            }}
          >
            {label}
          </div>
        </div>
        <p className="min-h-[2.6em] text-center text-[22px] font-bold opacity-90">{notice || message}</p>
      </div>

      <div className="flex bg-black/50">
        {view.teams.map((t) => (
          <div
            key={t.id}
            className="min-w-0 flex-1 truncate border-t-4 px-1 py-2.5 text-center text-sm"
            style={{ borderColor: t.color }}
          >
            {t.name}
            <b className="block text-[22px]">{t.score}</b>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 flex touch-manipulation flex-col overflow-hidden bg-ground text-ink select-none">{children}</div>;
}
