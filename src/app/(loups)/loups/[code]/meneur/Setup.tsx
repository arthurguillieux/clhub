"use client";

import { useState } from "react";
import { deckEntries, deckError, deckSize, suggestDeck, wolfCount, type Deck } from "@/modules/loups/domain/deck";
import { ROLES, roleName, type RoleId } from "@/modules/loups/domain/roles";
import type { HostView } from "@/modules/loups/views";
import type { Send } from "./ui";

type Player = { id: string; name: string };

/**
 * Before the game: the table (club members or free first names, the usual table to start with) and the deck,
 * suggested from the number of players until the meneur touches it.
 */
export function Setup({
  view,
  book,
  members,
  busy,
  send,
  addPlayer,
}: {
  view: HostView;
  book: { id: string; name: string; memberId: string | null }[];
  members: { id: string; name: string }[];
  busy: boolean;
  send: Send;
  addPlayer: (who: { name: string } | { memberId: string }) => Promise<Player | null>;
}) {
  const [players, setPlayers] = useState<Player[]>(view.seats.map((s) => ({ id: s.playerId, name: s.name })));
  const [deck, setDeck] = useState<Deck>(deckSize(view.deck) > 0 ? view.deck : suggestDeck(view.seats.length, view.plague));
  const [auto, setAuto] = useState(deckSize(view.deck) === 0);
  const [plague, setPlague] = useState(view.plague);
  const [dealMode, setDealMode] = useState(view.dealMode);
  const [name, setName] = useState("");
  const [member, setMember] = useState("");
  const [adding, setAdding] = useState("");
  const [kept, setKept] = useState(false);

  const save = (next: { players?: Player[]; deck?: Deck; plague?: boolean; dealMode?: "cards" | "app"; auto?: boolean }) => {
    const p = next.players ?? players;
    const pl = next.plague ?? plague;
    const keepAuto = next.auto ?? auto;
    const d = next.deck ?? (keepAuto ? suggestDeck(p.length, pl) : deck);
    setPlayers(p);
    setPlague(pl);
    setDeck(d);
    setAuto(keepAuto);
    if (next.dealMode) setDealMode(next.dealMode);
    return send({ type: "setup", playerIds: p.map((x) => x.id), deck: d, plague: pl, dealMode: next.dealMode ?? dealMode });
  };

  const add = async (who: { name: string } | { memberId: string }) => {
    const player = await addPlayer(who);
    if (!player) return;
    if (players.some((p) => p.id === player.id)) return setAdding(`${player.name} est déjà à la table.`);
    setAdding("");
    setName("");
    setMember("");
    await save({ players: [...players, player] });
  };

  const setCount = (id: RoleId, count: number) => {
    const next = { ...deck, [id]: Math.max(0, count) };
    if (next[id] === 0) delete next[id];
    void save({ deck: next, auto: false });
  };

  const atTable = new Set(players.map((p) => p.id));
  const freeNames = book.filter((p) => !atTable.has(p.id));
  const linked = new Set(book.filter((p) => p.memberId && atTable.has(p.id)).map((p) => p.memberId));
  const freeMembers = members.filter((m) => !linked.has(m.id));
  const error = deckError(deck, players.length);
  const size = deckSize(deck);
  const spare = size - players.length;
  const missing = ROLES.filter((r) => !(deck[r.id] ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <section className="loups-panel p-4">
        <p className="loups-label">Les joueurs · {players.length}</p>
        <p className="loups-muted mt-1 text-sm">Ta table habituelle est déjà là : retire les absents, ajoute les autres.</p>
        {players.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {players.map((p) => (
              <li key={p.id} className="loups-raised flex items-center gap-1 py-0.5 pr-0.5 pl-3">
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                <button type="button" aria-label={`Retirer ${p.name}`} className="h-10 w-10 rounded-full text-[var(--w-blood)]" disabled={busy} onClick={() => void save({ players: players.filter((x) => x.id !== p.id) })}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void add({ name });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} list="loups-book" maxLength={40} placeholder="Un prénom" aria-label="Prénom du joueur" className="loups-field min-h-11 min-w-0 flex-1 px-3" />
          <datalist id="loups-book">
            {freeNames.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <button type="submit" className="loups-btn-ghost min-h-11 px-4 text-sm" disabled={busy || !name.trim()}>
            Ajouter
          </button>
        </form>
        {freeMembers.length > 0 && (
          <div className="mt-2 flex gap-2">
            <select value={member} onChange={(e) => setMember(e.target.value)} aria-label="Membre du CLHUB à ajouter" className="loups-field min-h-11 min-w-0 flex-1 px-3">
              <option value="">Ou un membre du CLHUB…</option>
              {freeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button type="button" className="loups-btn-ghost min-h-11 px-4 text-sm" disabled={busy || !member} onClick={() => void add({ memberId: member })}>
              Ajouter
            </button>
          </div>
        )}
        {adding && <p className="mt-2 text-sm text-[var(--w-blood)]">{adding}</p>}
        {players.length > 0 && (
          <button
            type="button"
            className="loups-muted mt-2 py-2 text-sm underline"
            disabled={busy}
            onClick={async () => {
              if (!(await send({ type: "usualTable", playerIds: players.map((p) => p.id) }))) setKept(true);
            }}
          >
            {kept ? "Table gardée : les prochaines parties commenceront avec elle ✓" : "Garder cette table par défaut pour les prochaines parties"}
          </button>
        )}
      </section>

      <section className="loups-panel p-4">
        <p className="loups-label">Le deck · {size} cartes</p>
        <p className="loups-muted mt-1 text-sm">
          {auto ? `Proposé pour ${players.length} joueurs : ajuste-le à ton goût.` : "Ton deck sur mesure."}
          {spare > 0 && ` ${spare === 1 ? "Une carte en plus" : `${spare} cartes en plus`} que de joueurs : elles restent face cachée.`}
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {deckEntries(deck).map((e) => (
            <li key={e.id} className="loups-raised flex items-center gap-2 py-1 pr-1 pl-3">
              <span className={`min-w-0 flex-1 truncate font-semibold ${ROLES.find((r) => r.id === e.id)?.camp !== "village" ? "text-[var(--w-blood)]" : ""}`}>{roleName(e.id)}</span>
              <button type="button" aria-label={`Une carte ${roleName(e.id)} de moins`} className="h-10 w-10 rounded-full text-lg" disabled={busy} onClick={() => setCount(e.id, e.count - 1)}>
                −
              </button>
              <span className="w-6 text-center font-bold tabular-nums">{e.count}</span>
              <button type="button" aria-label={`Une carte ${roleName(e.id)} de plus`} className="h-10 w-10 rounded-full text-lg" disabled={busy} onClick={() => setCount(e.id, e.count + 1)}>
                +
              </button>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <select
            value=""
            aria-label="Ajouter une carte au deck"
            onChange={(e) => e.target.value && setCount(e.target.value as RoleId, 1)}
            className="loups-field mt-2 min-h-11 w-full px-3"
          >
            <option value="">➕ Ajouter une carte…</option>
            {missing.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={plague} onChange={(e) => void save({ plague: e.target.checked })} className="h-5 w-5 accent-[var(--w-rust)]" />
          <span>
            <b>Peste noire</b> : autant de cartes en plus que de loups ({wolfCount(deck)}), pour qu&apos;il arrive qu&apos;aucun loup ne soit tiré.
          </span>
        </label>
        {!auto && (
          <button type="button" className="mt-1 py-2 text-sm underline" disabled={busy} onClick={() => void save({ auto: true })}>
            Revenir au deck proposé pour {players.length} joueurs
          </button>
        )}
      </section>

      <section className="loups-panel p-4">
        <p className="loups-label">La distribution</p>
        <div className="mt-2 flex flex-col gap-1">
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="deal" checked={dealMode === "cards"} onChange={() => void save({ dealMode: "cards" })} className="h-5 w-5 accent-[var(--w-rust)]" />
            <span>
              Je distribue de vraies cartes
              <span className="loups-muted block text-xs">Tu noteras qui a quoi au fil de la première nuit.</span>
            </span>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="deal" checked={dealMode === "app"} onChange={() => void save({ dealMode: "app" })} className="h-5 w-5 accent-[var(--w-rust)]" />
            <span>
              Le CLHUB tire les cartes au sort
              <span className="loups-muted block text-xs">Chacun scanne le QR code et découvre sa carte, ou tu fais passer ton téléphone.</span>
            </span>
          </label>
        </div>
      </section>

      {error && players.length > 0 && <p className="text-center text-sm text-[var(--w-blood)]">{error}</p>}
      <button type="button" className="loups-btn min-h-14 px-6 text-lg" disabled={busy || !!error}
        onClick={async () => {
          // The proposed deck lives on this page until something is changed: saved first, then dealt.
          if (!(await save({}))) await send({ type: "launch" });
        }}
      >
        🐺 Lancer la partie
      </button>
    </div>
  );
}
