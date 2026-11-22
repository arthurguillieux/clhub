"use client";

import Link from "next/link";
import { callError } from "@/core/ui/callError";
import { useEffect, useRef, useState } from "react";
import { CAUSE_LABELS, WINNER_LABELS, isNight, phaseLabel, type Cause } from "@/modules/loups/domain/game";
import { roleName, roleOf } from "@/modules/loups/domain/roles";
import type { HostView } from "@/modules/loups/views";
import { deleteGameAction, meneurAction, replayAction } from "../../actions";
import { FlipCard, Reveal } from "../../Card";
import { Setup } from "./Setup";
import { Tracker } from "./Tracker";
import { LoupsDialog, SeatSelect, type Send } from "./ui";

/** The meneur's phone, from the setup to the end of the game. */
export function MeneurPanel({
  code,
  initialView,
  book,
  members,
  qrSvg,
}: {
  code: string;
  initialView: HostView;
  book: { id: string; name: string; memberId: string | null }[];
  members: { id: string; name: string }[];
  qrSvg: string;
}) {
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actions = useRef(0);

  const send: Send = async (action) => {
    actions.current += 1;
    setBusy(true);
    setError("");
    try {
      const result = await meneurAction(code, action);
      if (!result.ok) {
        setError(result.error);
        return result.error;
      }
      setView(result.view);
      return null;
    } catch (e) {
      setError(callError(e));
      return "Pas de connexion";
    } finally {
      actions.current += 1;
      setBusy(false);
    }
  };

  // While the phones look at their cards, who has seen theirs shows up by itself.
  useEffect(() => {
    if (view.status !== "dealing") return;
    const timer = setInterval(async () => {
      const before = actions.current;
      try {
        const result = await meneurAction(code, { type: "refresh" });
        if (result.ok && actions.current === before) setView(result.view);
      } catch {
        // The next round will do.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [code, view.status]);

  const addPlayer = async (who: { name: string } | { memberId: string }) => {
    setBusy(true);
    setError("");
    try {
      const result = await meneurAction(code, { type: "addPlayer", ...who });
      if (!result.ok || !result.playerId) {
        setError(result.ok ? "Impossible d'ajouter ce joueur." : result.error);
        return null;
      }
      const name = "name" in who ? who.name.replace(/\s+/g, " ").trim() : (members.find((m) => m.id === who.memberId)?.name ?? "?");
      return { id: result.playerId, name: book.find((p) => p.id === result.playerId)?.name ?? name };
    } catch (e) {
      setError(callError(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const night = view.status === "playing" && isNight(view.tracker.turn);

  return (
    <div className={`loups ${night ? "loups-night" : ""} px-4 pt-6 pb-24`}>
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <header>
          <Link href="/jeux/loups" className="loups-muted text-sm">
            ← Loups-garous
          </Link>
          <p className="loups-label mt-3">
            Partie {code} · {view.seats.length} joueurs
          </p>
          {view.status === "setup" && <h1 className="loups-title mt-1 text-3xl">Nouvelle partie</h1>}
        </header>
        {error && (
          <p role="alert" className="loups-panel border-[var(--w-blood)] p-3 text-sm text-[var(--w-blood)]">
            {error}
          </p>
        )}
        {view.status === "setup" && <Setup view={view} book={book} members={members} busy={busy} send={send} addPlayer={addPlayer} />}
        {view.status === "dealing" && <ShareRules key="dealing" view={view} qrSvg={qrSvg} />}
        {view.status === "dealing" && <Dealing view={view} busy={busy} send={send} />}
        {view.status === "playing" && <Tracker view={view} busy={busy} send={send} />}
        {/* Folded during the game: a white QR code lights up the room at night. */}
        {view.status === "playing" && <ShareRules key="playing" view={view} qrSvg={qrSvg} />}
        {view.status !== "setup" && <RoomScreen view={view} busy={busy} send={send} />}
        {view.status === "done" && <Done view={view} code={code} />}
        <DeleteGame code={code} done={view.status === "done"} />
      </div>
    </div>
  );
}

/** The link to the deck and its rules, for the players to read on their phones. */
function ShareRules({ view, qrSvg }: { view: HostView; qrSvg: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(view.status === "dealing");
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Loups-garous", text: "Les cartes de la partie et leurs règles :", url: view.link });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(view.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="loups-panel p-4" data-player-link={view.link}>
      <p className="loups-label">Le lien des joueurs</p>
      <p className="loups-muted mt-1 text-sm">
        {view.dealMode === "app" ? "Chacun y découvre sa carte, et les règles de toutes les cartes du deck." : "Les cartes du deck et leurs règles, pour qui ne connaît pas la sienne."}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="loups-btn-ghost min-h-11 px-3 text-sm" onClick={() => void share()}>
          {copied ? "Lien copié ✓" : "📤 Partager le lien"}
        </button>
        <button type="button" className="loups-btn-ghost min-h-11 px-3 text-sm" onClick={() => setQr(!qr)}>
          {qr ? "Cacher le QR code" : "▦ QR code"}
        </button>
      </div>
      {qr && <div className="mx-auto mt-3 w-full max-w-64 rounded-2xl bg-white p-3" aria-label="QR code du lien des joueurs" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
    </section>
  );
}

/** The CLHUB dealt: each player sees their card on their phone, or on the meneur's passed around. */
function Dealing({ view, busy, send }: { view: HostView; busy: boolean; send: Send }) {
  const [passing, setPassing] = useState<string | null>(null);
  const seen = view.seats.filter((s) => s.seen).length;
  const seat = view.seats.find((s) => s.id === passing);
  return (
    <section className="flex flex-col gap-3">
      <div className="loups-panel p-4">
        <p className="loups-label">
          Les cartes · {seen} sur {view.seats.length} vues
        </p>
        <p className="loups-muted mt-1 text-sm">Chacun scanne le QR code et touche son prénom. Sans téléphone, fais passer le tien : « Montrer ».</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {view.seats.map((s) => (
            <li key={s.id} className="loups-raised flex items-center gap-2 py-1 pr-1 pl-3">
              <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
              <span className={`text-xs ${s.seen ? "text-[var(--w-village)]" : "loups-muted"}`}>{s.seen ? (s.claimed ? "sur son téléphone ✓" : "vue ✓") : "pas encore"}</span>
              {s.seen ? (
                <button type="button" className="loups-muted min-h-10 px-2 text-xs underline" disabled={busy} onClick={() => void send({ type: "seen", seat: s.id, seen: false })}>
                  Libérer
                </button>
              ) : (
                <button type="button" className="loups-btn-ghost min-h-10 px-3 text-xs" disabled={busy} onClick={() => setPassing(s.id)}>
                  Montrer
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="loups-btn min-h-14 px-6 text-lg" disabled={busy} onClick={() => void send({ type: "startNight" })}>
        🌙 Tout le monde a sa carte : la nuit tombe
      </button>
      {seat && <PassPhone name={seat.name} role={seat.role} art={view.art} onDone={() => void send({ type: "seen", seat: seat.id, seen: true }).then(() => setPassing(null))} onClose={() => setPassing(null)} />}
    </section>
  );
}

/** The meneur's phone in a player's hands: their name first, the card only once they tap. */
function PassPhone({ name, role, art, onDone, onClose }: { name: string; role: string | null; art: Record<string, string>; onDone: () => void; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  return (
    <LoupsDialog title={shown ? name : `Passe le téléphone à ${name}`} onClose={onClose}>
      {shown ? (
        <>
          <div className="mx-auto w-56">
            <FlipCard role={role} art={art} face />
          </div>
          <p className="loups-title text-center text-2xl">{roleName(role)}</p>
          <p className="loups-muted text-sm">{role ? roleOf(role)?.rule : ""}</p>
          <button type="button" className="loups-btn min-h-12 px-4" onClick={onDone}>
            J&apos;ai vu, je cache et je rends le téléphone
          </button>
        </>
      ) : (
        <>
          <p className="text-sm">Seul·e {name} regarde l&apos;écran.</p>
          <button type="button" className="loups-btn min-h-12 px-4" onClick={() => setShown(true)}>
            Je suis {name} : voir ma carte
          </button>
          <button type="button" className="loups-btn-ghost min-h-12 px-4" onClick={onClose}>
            Pas maintenant
          </button>
        </>
      )}
    </LoupsDialog>
  );
}

/**
 * The room's screen, for the evenings that want it on a projector (the game, the dead, the time),
 * and « Révéler une carte » when the CLHUB dealt: it turns over on this phone and on the screen.
 */
function RoomScreen({ view, busy, send }: { view: HostView; busy: boolean; send: Send }) {
  const [who, setWho] = useState<string | null>(null);
  const [shown, setShown] = useState<{ name: string; role: string } | null>(null);
  const screen = view.link.replace("/loups/partie/", "/loups/ecran/");
  const reveal = async () => {
    const seat = view.seats.find((s) => s.id === who);
    if (!seat?.role) return;
    if (!(await send({ type: "reveal", seat: seat.id }))) {
      setShown({ name: seat.name, role: seat.role });
      setWho(null);
    }
  };
  return (
    <details className="loups-panel p-4">
      <summary className="loups-label cursor-pointer py-1">L&apos;écran de la salle{view.dealMode === "app" ? " · révéler une carte" : ""}</summary>
      <p className="loups-muted mt-2 text-sm">
        Pour un vidéoprojecteur ou une télé : les joueurs, les morts et leur carte, ce qui reste en jeu, la durée de la partie{view.dealMode === "app" ? ", et le QR code dans un coin" : ""}.
      </p>
      <a href={screen} target="_blank" rel="noopener noreferrer" className="loups-btn-ghost mt-2 flex min-h-11 px-3 text-sm">
        Ouvrir l&apos;écran ↗
      </a>
      {view.dealMode === "app" && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm">Un joueur sans son téléphone : sa carte se retourne ici et sur l&apos;écran.</p>
          <SeatSelect seats={view.seats.filter((s) => s.role)} value={who} onChange={setWho} label="Carte à révéler" none="Quel joueur ?" />
          <button type="button" className="loups-btn min-h-12 px-4" disabled={busy || !who} onClick={() => void reveal()}>
            Révéler sa carte
          </button>
          {view.reveal && (
            <button type="button" className="loups-muted py-2 text-sm underline" disabled={busy} onClick={() => void send({ type: "reveal", seat: null })}>
              Retirer la carte de l&apos;écran
            </button>
          )}
        </div>
      )}
      {shown && <Reveal name={shown.name} role={shown.role} art={view.art} onClose={() => setShown(null)} />}
    </details>
  );
}

/** The game is over: who won, who was who, and the next one. */
function Done({ view, code }: { view: HostView; code: string }) {
  const [going, setGoing] = useState(false);
  const go = (adjust: boolean) => {
    setGoing(true);
    replayAction(code, adjust).catch(() => setGoing(false));
  };
  return (
    <section className="flex flex-col gap-4">
      <div className="loups-panel p-5 text-center">
        <p className="loups-label">{phaseLabel(view.tracker.turn)}</p>
        <h1 className="loups-title mt-2 text-3xl">🏁 {view.winner ? WINNER_LABELS[view.winner] : "Partie terminée"}</h1>
        {view.blackPlague && <p className="loups-muted mt-1 text-sm">☣️ C&apos;était une peste noire.</p>}
      </div>
      <ul className="loups-panel flex flex-col gap-1.5 p-4">
        {view.seats.map((s) => (
          <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className={s.alive ? "font-semibold" : "loups-muted line-through"}>{s.name}</span>
            <span>
              {roleName(s.startRole ?? s.role)}
              {s.startRole && s.role && s.startRole !== s.role && ` → ${roleName(s.role)}`}
              <span className="loups-muted">
                {" · "}
                {s.alive ? "en vie" : `${s.diedTurn ? phaseLabel(s.diedTurn) : ""}, ${CAUSE_LABELS[(s.cause ?? "autre") as Cause] ?? "mort"}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="loups-btn min-h-14 px-6 text-lg" disabled={going} onClick={() => go(false)}>
        🔁 Relancer la même partie
      </button>
      <button type="button" className="loups-btn-ghost min-h-12 px-4" disabled={going} onClick={() => go(true)}>
        🃏 Ajuster les joueurs ou le deck
      </button>
      <Link href="/jeux/loups" className="loups-muted py-2 text-center text-sm underline">
        Voir les stats
      </Link>
    </section>
  );
}

/** A test game, a game abandoned: gone, and out of the stats. */
function DeleteGame({ code, done }: { code: string; done: boolean }) {
  const [asking, setAsking] = useState(false);
  const [going, setGoing] = useState(false);
  return (
    <>
      <button type="button" className="py-2 text-sm text-[var(--w-blood)] underline" onClick={() => setAsking(true)}>
        Supprimer cette partie
      </button>
      {asking && (
        <LoupsDialog title="Supprimer cette partie ?" onClose={() => setAsking(false)}>
          <p className="text-sm">
            {done ? "Elle disparaît de ta liste et ne compte plus dans tes stats ni dans le carnet des joueurs." : "Elle disparaît de ta liste, et le lien des joueurs ne mènera plus nulle part."} C&apos;est définitif.
          </p>
          <button
            type="button"
            className="loups-btn-red min-h-12 px-4"
            disabled={going}
            onClick={() => {
              setGoing(true);
              deleteGameAction(code).catch(() => setGoing(false));
            }}
          >
            {going ? "Suppression…" : "Supprimer définitivement"}
          </button>
          <button type="button" className="loups-btn-ghost min-h-12 px-4" onClick={() => setAsking(false)}>
            Garder la partie
          </button>
        </LoupsDialog>
      )}
    </>
  );
}
