"use client";

import { FlipCard } from "../../Card";
import { useEffect, useState } from "react";
import { WINNER_LABELS } from "@/modules/loups/domain/game";
import type { PlayerView } from "@/modules/loups/views";
import { playerAction } from "../../actions";

const keyName = (token: string) => `clhub:loups:${token}`;
const readKey = (token: string) => {
  try {
    return window.localStorage.getItem(keyName(token));
  } catch {
    return null;
  }
};
const writeKey = (token: string, key: string | null) => {
  try {
    if (key) window.localStorage.setItem(keyName(token), key);
    else window.localStorage.removeItem(keyName(token));
  } catch {
    // Private browsing: the player taps their name again next time.
  }
};

/** A player's phone: « c'est moi », then the card, hidden until tapped; the rules of the deck below. */
export function PlayerScreen({ token, initialView }: { token: string; initialView: PlayerView }) {
  const [view, setView] = useState(initialView);
  const [key, setKey] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = readKey(token);
    const refresh = async () => {
      try {
        const result = await playerAction(token, readKey(token), { t: "view" });
        if (result.ok) {
          setView(result.view);
          // The meneur freed this seat: the phone forgets it.
          if (!result.view.me && readKey(token)) writeKey(token, null);
          setKey(result.view.me ? readKey(token) : null);
        }
      } catch {
        // Offline for a moment.
      }
    };
    if (stored) void refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && void refresh(), 15000);
    return () => clearInterval(timer);
  }, [token]);

  const claim = async (seat: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await playerAction(token, key, { t: "claim", seat });
      if (result.view) setView(result.view);
      if (!result.ok) return setError(result.error);
      writeKey(token, result.key);
      setKey(result.key);
      setPicking(null);
    } catch {
      setError("Pas de connexion — réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const dealing = view.dealMode === "app" && (view.status === "dealing" || view.status === "playing");
  const free = view.seats.filter((s) => !s.claimed);

  return (
    <div className="loups px-4 pt-8 pb-20">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <header className="text-center">
          <p className="loups-label">Loups-garous · {view.players} joueurs</p>
          <h1 className="loups-title mt-2 text-3xl">{view.me ? `${view.me.name}, voici ta carte` : "Bienvenue au village"}</h1>
          <p className="loups-muted mt-1 text-sm">Partie menée par {view.meneur}.</p>
        </header>

        {view.end && <End view={view} />}

        {!view.end && view.me && <MyCard art={view.art} me={view.me} />}

        {!view.end && !view.me && dealing && (
          <section className="loups-panel p-4">
            <p className="loups-label">Qui es-tu ?</p>
            <p className="loups-muted mt-1 text-sm">Touche ton prénom pour découvrir ta carte. Personne d&apos;autre ne la verra sur ce téléphone.</p>
            {free.length === 0 ? (
              <p className="mt-3 text-sm">Tout le monde a déjà sa carte. Si ton prénom a été pris par erreur, demande au meneur de le libérer.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {free.map((s) => (
                  <button key={s.id} type="button" className="loups-btn-ghost min-h-12 px-3" disabled={busy} onClick={() => setPicking(s)}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-sm text-[var(--w-blood)]">
                {error}
              </p>
            )}
          </section>
        )}

        {!view.end && view.dealMode === "cards" && <p className="loups-panel p-4 text-center text-sm">Le meneur distribue de vraies cartes. Retourne la tienne en secret, et viens lire sa règle ici si besoin.</p>}

        <Rules view={view} />
      </div>

      {picking && (
        <div role="dialog" aria-modal="true" aria-label="Confirmer le prénom" className="loups-veil fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" onClick={() => setPicking(null)}>
          <div className="loups-panel w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="loups-title text-xl">Tu es bien {picking.name} ?</p>
            <p className="loups-muted mt-1 text-sm">Ce prénom sera à toi sur ce téléphone, et ta carte s&apos;affichera ici.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="loups-btn min-h-12 px-4" disabled={busy} onClick={() => void claim(picking.id)}>
                Oui, je suis {picking.name}
              </button>
              <button type="button" className="loups-btn-ghost min-h-12 px-4" onClick={() => setPicking(null)}>
                Non, retour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The card, face down until its player taps it, and turned back with one more tap. */
function MyCard({ me, art }: { me: NonNullable<PlayerView["me"]>; art: Record<string, string> }) {
  const [shown, setShown] = useState(false);
  return (
    <section className="flex flex-col items-center gap-3">
      <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? "Cacher ma carte" : "Voir ma carte"} className="w-60">
        <FlipCard role={me.role} art={art} face={shown} />
      </button>
      {shown ? (
        <>
          <p className="loups-title text-center text-3xl">{me.roleName}</p>
          <p className="loups-muted max-w-sm text-center text-sm">{me.rule}</p>
          <button type="button" className="loups-btn-ghost min-h-11 px-4 text-sm" onClick={() => setShown(false)}>
            Cacher ma carte
          </button>
        </>
      ) : (
        <>
          <p className="loups-title text-xl">Touche pour voir ta carte</p>
          <p className="loups-muted text-xs">Cache l&apos;écran des autres</p>
        </>
      )}
    </section>
  );
}

function Rules({ view }: { view: PlayerView }) {
  return (
    <section className="loups-panel p-4">
      <p className="loups-label">Les cartes de la partie</p>
      <p className="loups-muted mt-1 text-sm">
        {view.deck.reduce((n, d) => n + d.count, 0)} cartes pour {view.players} joueurs.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {view.deck.map((d) => (
          <li key={d.id}>
            <details className="loups-raised px-3 py-2">
              <summary className="cursor-pointer font-semibold">
                {d.count > 1 ? `${d.count} × ` : ""}
                {d.name}
              </summary>
              <p className="loups-muted mt-1 text-sm">{d.rule}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function End({ view }: { view: PlayerView }) {
  if (!view.end) return null;
  return (
    <section className="loups-panel p-4">
      <p className="loups-title text-center text-2xl">🏁 {WINNER_LABELS[view.end.winner]}</p>
      {view.end.blackPlague && <p className="loups-muted mt-1 text-center text-sm">☣️ C&apos;était une peste noire.</p>}
      <p className="loups-label mt-4">Qui était qui</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {view.end.seats.map((s) => (
          <li key={s.name} className="flex justify-between gap-3">
            <span className={s.alive ? "font-semibold" : "loups-muted line-through"}>{s.name}</span>
            <span>{s.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
