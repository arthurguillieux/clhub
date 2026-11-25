"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { callError } from "@/core/ui/callError";
import { CATEGORIES, emptyHanded, parseAmount, type Category } from "@/modules/repas/domain/list";
import type { GuestView, ItemView, MealView } from "@/modules/repas/data/meals";
import { mealAction } from "./actions";
import type { MealRef } from "./load";
import { Organizer } from "./Organizer";

export type Act = (input: Record<string, unknown>) => Promise<string | null>;

const UNITS = ["", "g", "kg", "L", "cl", "pièce", "bouteille", "paquet", "bocal", "pot"];
const AVATAR = ["#ffc94a", "#ff7a59", "#8fd694", "#7fc8ff", "#d7a6ff", "#ffb3c7", "#f6ead7"];
export const avatarColor = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length]!;
const frDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/**
 * A meal, for everyone who opens it: what they bring first (or a joke if nothing yet), what's still
 * missing, the list, and the organizer's tools. The same screen on the club's page and on the link
 * for guests without an account.
 */
export function MealScreen({ mealRef, initial, seed, signedIn, admin = false }: { mealRef: MealRef; initial: MealView; seed: number; signedIn: boolean; admin?: boolean }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const act: Act = async (input) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const result = await mealAction(mealRef, input);
      if (!result.ok) {
        setError(result.error);
        return result.error;
      }
      setView(result.view);
      if (result.info) setInfo(result.info);
      if (result.go) router.push(result.go);
      return null;
    } catch (e) {
      const message = callError(e);
      setError(message);
      return message;
    } finally {
      setBusy(false);
    }
  };

  // Others' choices show up by themselves.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void mealAction(mealRef, { type: "refresh" })
        .then((r) => r.ok && setView(r.view))
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [mealRef]);

  const me = view.me;
  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-10 sm:px-6">
      <Confetti feast={view.feast} mealId={view.id} />
      <Header view={view} />
      {(error || info) && (
        <p role={error ? "alert" : "status"} className={`repas-raised px-3 py-2 text-sm ${error ? "text-[var(--r-tomato)]" : "text-[var(--r-herb)]"}`}>
          {error || info}
        </p>
      )}
      {!me && "token" in mealRef && <WhoAreYou view={view} busy={busy} act={act} signedIn={signedIn} />}
      {view.canJoin && (
        <section className="repas-card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">Ce repas est ouvert à tout le club.</p>
          <button type="button" className="repas-btn" disabled={busy} onClick={() => void act({ type: "join" })}>
            Je viens aussi
          </button>
        </section>
      )}
      {me && <MyPart view={view} me={me} seed={seed} busy={busy} act={act} />}
      <Missing view={view} />
      <List view={view} busy={busy} act={act} />
      {view.organizer && <Organizer view={view} busy={busy} act={act} admin={admin} />}
      {!view.organizer && (
        <p className="repas-muted text-center text-xs">
          Organisé par {view.organizerName}.{" "}
          {"token" in mealRef && !signedIn ? "Pas besoin de compte : ce lien suffit." : ""}
        </p>
      )}
    </div>
  );
}

function Header({ view }: { view: MealView }) {
  const coming = view.guests.filter((g) => g.status === "yes");
  const heads = coming.reduce((s, g) => s + 1 + g.plusOnes, 0);
  return (
    <header className="flex flex-col gap-3">
      <p className="repas-label">
        {frDate(view.date)}
        {view.time ? ` · ${view.time}` : ""}
        {view.place ? ` · ${view.place}` : ""}
      </p>
      <h1 className="repas-title text-3xl tracking-tight sm:text-4xl">{view.title}</h1>
      {view.note && <p className="repas-muted max-w-prose text-sm whitespace-pre-line">{view.note}</p>}
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Les invités">
        {view.guests.map((g) => (
          <span key={g.id} title={`${g.name}${g.status === "yes" ? " vient" : g.status === "no" ? " ne vient pas" : g.status === "maybe" ? " viendra peut-être" : " n'a pas encore répondu"}`} className="repas-avatar" style={{ background: avatarColor(g.name), opacity: g.status === "yes" ? 1 : g.status === "no" ? 0.25 : 0.55 }}>
            {g.name.charAt(0).toUpperCase()}
          </span>
        ))}
        <span className="repas-muted ml-1 text-sm">
          {heads} {heads > 1 ? "convives" : "convive"} · {view.guests.filter((g) => g.status === null).length} sans réponse
        </span>
      </div>
      {view.items.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold">Le festin</span>
            <span className="repas-muted">{view.feast === 100 ? "tout est pris 🎉" : `${view.feast} % de la liste est prise`}</span>
          </div>
          <div className="repas-gauge mt-1.5">
            <span style={{ width: `${view.feast}%` }} />
          </div>
        </div>
      )}
    </header>
  );
}

/** On the link, for guests without an account: « Qui es-tu ? » among the names, or « Je ne suis pas sur la liste ». */
function WhoAreYou({ view, busy, act, signedIn }: { view: MealView; busy: boolean; act: Act; signedIn: boolean }) {
  const [name, setName] = useState("");
  const [asking, setAsking] = useState<GuestView | null>(null);
  const free = view.guests.filter((g) => !g.member);
  return (
    <section className="repas-card flex flex-col gap-3 p-4">
      <p className="repas-title text-xl">Qui es-tu ?</p>
      {signedIn && <p className="repas-muted text-sm">Si tu as un compte au CLHUB et que tu es invité, ouvre plutôt le potluck depuis la section Potlucks.</p>}
      {free.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {free.map((g) => (
            <button key={g.id} type="button" className="repas-ghost" disabled={busy} onClick={() => setAsking(g)}>
              {g.name}
            </button>
          ))}
        </div>
      )}
      {asking && (
        <div className="repas-raised flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="flex-1">
            Tu es bien <b>{asking.name}</b> ?{asking.taken ? " (quelqu'un a déjà choisi ce prénom sur un autre appareil : il sera remplacé par celui-ci)" : ""}
          </span>
          <button type="button" className="repas-btn" disabled={busy} onClick={() => void act({ type: "iam", guestId: asking.id }).then((e) => !e && setAsking(null))}>
            Oui, c&apos;est moi
          </button>
          <button type="button" className="repas-ghost" onClick={() => setAsking(null)}>
            Non
          </button>
        </div>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void act({ type: "addSelf", name: name.trim() });
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ton prénom" aria-label="Ton prénom, si tu n'es pas sur la liste" className="repas-field min-w-0 flex-1" />
        <button type="submit" className="repas-ghost" disabled={busy || !name.trim()}>
          Je ne suis pas sur la liste
        </button>
      </form>
    </section>
  );
}

/** « Ce que tu ramènes », first thing on the page; and whether you come. */
function MyPart({ view, me, seed, busy, act }: { view: MealView; me: GuestView; seed: number; busy: boolean; act: Act }) {
  const mine = view.items.flatMap((i) => i.claims.filter((c) => c.mine).map((c) => ({ item: i, claim: c })));
  return (
    <section className="repas-card flex flex-col gap-3 p-4" aria-label="Ce que tu ramènes">
      <div className="flex items-baseline justify-between gap-2">
        <p className="repas-label">Ce que tu ramènes, {me.name}</p>
        {!me.member && (
          <button type="button" className="repas-muted text-xs underline" disabled={busy} onClick={() => void act({ type: "notme" })}>
            Ce n&apos;est pas moi
          </button>
        )}
      </div>
      {mine.length === 0 ? (
        <p className="repas-title text-xl text-[var(--r-cheese)]">« {emptyHanded(seed)} »</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {mine.map(({ item, claim }) => (
            <li key={claim.id}>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" checked={claim.bought} disabled={busy} onChange={(e) => void act({ type: "bought", claimId: claim.id, bought: e.target.checked })} className="h-5 w-5 accent-[var(--r-herb)]" />
                <span className={claim.bought ? "repas-muted line-through" : "font-semibold"}>
                  {item.label}
                  {claim.amount && claim.amount !== "tout" ? ` · ${claim.amount}` : item.amount ? ` · ${item.amount}` : ""}
                </span>
              </label>
            </li>
          ))}
          <li className="repas-muted text-xs">Coche ce que tu as acheté : c&apos;est ta liste de courses.</li>
        </ul>
      )}
      <Response me={me} busy={busy} act={act} />
    </section>
  );
}

function Response({ me, busy, act }: { me: GuestView; busy: boolean; act: Act }) {
  const send = (patch: Partial<{ status: string; plusOnes: number; vege: boolean | null }>) =>
    void act({ type: "respond", status: me.status ?? "yes", plusOnes: me.plusOnes, vege: me.member ? null : me.vege, ...patch });
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--r-line)] pt-3">
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Tu viens ?">
        {(
          [
            ["yes", "Je viens"],
            ["maybe", "Peut-être"],
            ["no", "Je ne peux pas"],
          ] as const
        ).map(([s, label]) => (
          <button key={s} type="button" aria-pressed={me.status === s} className={me.status === s ? "repas-btn px-2 text-sm" : "repas-ghost px-2 text-sm"} disabled={busy} onClick={() => send({ status: s })}>
            {label}
          </button>
        ))}
      </div>
      {me.status !== "no" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            Avec moi
            <button type="button" aria-label="Une personne de moins" className="repas-ghost h-9 min-h-9 w-9 px-0" disabled={busy || me.plusOnes === 0} onClick={() => send({ plusOnes: me.plusOnes - 1 })}>
              −
            </button>
            <b className="w-4 text-center tabular-nums">{me.plusOnes}</b>
            <button type="button" aria-label="Une personne de plus" className="repas-ghost h-9 min-h-9 w-9 px-0" disabled={busy || me.plusOnes >= 10} onClick={() => send({ plusOnes: me.plusOnes + 1 })}>
              +
            </button>
          </span>
          {!me.member && (
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={me.vege} disabled={busy} onChange={(e) => send({ vege: e.target.checked })} className="h-5 w-5 accent-[var(--r-herb)]" />
              Je suis végé
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function Missing({ view }: { view: MealView }) {
  const missing = view.items.filter((i) => !i.covered);
  if (!missing.length || missing.length === view.items.length) return null;
  return (
    <section aria-label="Il manque encore">
      <p className="repas-label text-[var(--r-tomato)]">Il manque encore</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {missing.map((i) => (
          <li key={i.id}>
            <a href={`#ligne-${i.id}`} className="repas-raised inline-flex min-h-9 items-center px-3 text-sm">
              {i.label}
              {i.missingLabel && <span className="repas-muted ml-1.5">{i.missingLabel}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function List({ view, busy, act }: { view: MealView; busy: boolean; act: Act }) {
  const [adding, setAdding] = useState(false);
  const canAdd = view.organizer || !!view.me;
  return (
    <section className="flex flex-col gap-4" aria-label="Qui ramène quoi">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="repas-title text-2xl">Qui ramène quoi</h2>
        {canAdd && !adding && (
          <button type="button" className="text-sm font-bold text-[var(--r-cheese)]" onClick={() => setAdding(true)}>
            + Proposer une idée
          </button>
        )}
      </div>
      {adding && <ItemForm busy={busy} onCancel={() => setAdding(false)} onSave={async (fields) => !(await act({ type: "addItem", ...fields })) && setAdding(false)} />}
      {view.items.length === 0 && !adding && (
        <p className="repas-muted text-sm">{view.organizer ? "La liste est vide : utilise le calculateur plus bas pour partir d'une base, ou ajoute tes lignes." : "La liste est encore vide."}</p>
      )}
      {CATEGORIES.map((c) => {
        const items = view.items.filter((i) => i.category === c.id);
        if (!items.length) return null;
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <p className="repas-label">
              {c.emoji} {c.label}
            </p>
            {items.map((i) => (
              <ItemRow key={i.id} item={i} view={view} busy={busy} act={act} />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function ItemRow({ item, view, busy, act }: { item: ItemView; view: MealView; busy: boolean; act: Act }) {
  const [mode, setMode] = useState<null | "part" | "edit">(null);
  const [part, setPart] = useState("");
  const mine = item.claims.find((c) => c.mine);
  const pct = item.quantity ? Math.min(100, Math.round((item.promised / item.quantity) * 100)) : item.covered ? 100 : 0;
  if (mode === "edit")
    return (
      <ItemForm
        busy={busy}
        initial={item}
        onCancel={() => setMode(null)}
        onSave={async (fields) => !(await act({ type: "updateItem", itemId: item.id, ...fields })) && setMode(null)}
        onRemove={async () => !(await act({ type: "removeItem", itemId: item.id })) && setMode(null)}
      />
    );
  return (
    <div id={`ligne-${item.id}`} className={`repas-card flex flex-col gap-2 p-3 ${item.covered ? "border-[color-mix(in_srgb,var(--r-herb)_45%,transparent)]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0">
          <span className="font-bold">{item.label}</span>
          {item.amount && <span className="repas-muted"> · {item.amount}</span>}
        </p>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`text-xs font-bold ${item.covered ? "text-[var(--r-herb)]" : "text-[var(--r-tomato)]"}`}>{item.covered ? "✓ pris" : item.missingLabel ? `il manque ${item.missingLabel}` : "personne"}</span>
          {item.canEdit && (
            <button type="button" aria-label={`Modifier ou retirer « ${item.label} »`} className="repas-muted h-9 w-9 rounded-full text-sm" onClick={() => setMode("edit")}>
              ✎
            </button>
          )}
        </span>
      </div>
      {item.quantity !== null && (
        <div className="repas-gauge h-2">
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      {item.claims.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {item.claims.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5 rounded-full bg-[var(--r-raised)] py-0.5 pr-2.5 pl-0.5 text-xs">
              <span className="repas-avatar h-6 w-6 text-[0.65rem]" style={{ background: avatarColor(c.name) }}>
                {c.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold">{c.mine ? "toi" : c.name}</span>
              {c.amount && <span className="repas-muted">{c.amount}</span>}
            </li>
          ))}
        </ul>
      )}
      {item.loans.length > 0 && (
        <p className="text-xs">
          Dans la Prêtothèque :{" "}
          {item.loans.map((l, k) => (
            <span key={l.slug}>
              {k > 0 && ", "}
              <Link href={`/pretotheque/${l.slug}`} className="font-semibold text-[var(--r-cheese)] underline">
                {l.name}
              </Link>{" "}
              <span className="repas-muted">({l.owner})</span>
            </span>
          ))}
        </p>
      )}
      {view.me && mode === "part" && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseAmount(part);
            if (n !== null) void act({ type: "claim", itemId: item.id, quantity: n }).then((err) => !err && setMode(null));
          }}
        >
          <input value={part} onChange={(e) => setPart(e.target.value)} inputMode="decimal" placeholder={item.missing ? String(item.missing).replace(".", ",") : "Combien ?"} aria-label={`Combien de ${item.label}`} className="repas-field w-28" autoFocus />
          <span className="repas-muted text-sm">{item.unit ?? ""}</span>
          <button type="submit" className="repas-btn" disabled={busy || parseAmount(part) === null}>
            Je ramène ça
          </button>
          <button type="button" className="repas-ghost" onClick={() => setMode(null)}>
            Annuler
          </button>
        </form>
      )}
      {view.me && mode !== "part" && (
        <div className="flex flex-wrap gap-2">
          {mine ? (
            <>
              {item.quantity !== null && (
                <button type="button" className="repas-ghost text-sm" disabled={busy} onClick={() => setMode("part")}>
                  Changer la quantité
                </button>
              )}
              <button type="button" className="repas-danger text-sm" disabled={busy} onClick={() => void act({ type: "unclaim", itemId: item.id })}>
                Je ne le ramène plus
              </button>
            </>
          ) : (
            <>
              {(!item.covered || item.quantity === null) && (
                <button type="button" className="repas-btn text-sm" disabled={busy || item.rest === 0} onClick={() => void act({ type: "claim", itemId: item.id, quantity: "all" })}>
                  {item.quantity === null ? "Je m'en occupe" : item.promised > 0 ? `Je ramène le reste (${item.missingLabel})` : "Je ramène tout"}
                </button>
              )}
              {item.quantity !== null && (
                <button type="button" className="repas-ghost text-sm" disabled={busy} onClick={() => setMode("part")}>
                  J&apos;en ramène…
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** A line: what, how much (optional), and where it goes. */
export function ItemForm({
  initial,
  busy,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: ItemView;
  busy: boolean;
  onSave: (fields: { label: string; quantity: number | null; unit: string | null; category: Category }) => Promise<unknown>;
  onCancel: () => void;
  onRemove?: () => Promise<unknown>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [qty, setQty] = useState(initial?.quantity !== null && initial?.quantity !== undefined ? String(initial.quantity).replace(".", ",") : "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "manger");
  const [removing, setRemoving] = useState(false);
  const quantity = qty.trim() ? parseAmount(qty) : null;
  return (
    <form
      className="repas-card flex flex-col gap-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (label.trim()) void onSave({ label: label.trim(), quantity, unit: unit || null, category });
      }}
    >
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Des bières, un dessert, des chaises…" aria-label="Ce qu'il faut ramener" className="repas-field" autoFocus />
      <div className="flex flex-wrap gap-2">
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="Quantité (facultatif)" aria-label="Quantité" className="repas-field w-40" />
        <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unité" className="repas-field">
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u || "unité…"}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)} aria-label="Catégorie" className="repas-field">
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </div>
      {qty.trim() && quantity === null && <p className="text-xs text-[var(--r-tomato)]">La quantité doit être un nombre.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="repas-btn" disabled={busy || !label.trim() || (!!qty.trim() && quantity === null)}>
          {initial ? "Enregistrer" : "Ajouter à la liste"}
        </button>
        <button type="button" className="repas-ghost" onClick={onCancel}>
          Annuler
        </button>
        {onRemove && !removing && (
          <button type="button" className="repas-danger ml-auto" disabled={busy} onClick={() => setRemoving(true)}>
            Retirer cette ligne
          </button>
        )}
      </div>
      {onRemove && removing && (
        <div role="alertdialog" aria-label={`Retirer « ${initial?.label ?? label} » ?`} className="repas-raised flex flex-col gap-2 p-3 text-sm">
          <p>
            Retirer « {initial?.label ?? label} » de la liste ?{initial?.claims.length ? ` ${initial.claims.map((c) => c.name).join(", ")} ne le ramène${initial.claims.length > 1 ? "nt" : ""} plus.` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="repas-danger" disabled={busy} onClick={() => void onRemove()}>
              Retirer la ligne
            </button>
            <button type="button" className="repas-ghost" onClick={() => setRemoving(false)}>
              Garder la ligne
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

/** When the whole list is taken: a shower of cheese, once per meal on this browser. */
function Confetti({ feast, mealId }: { feast: number; mealId: string }) {
  const [pieces, setPieces] = useState<{ left: number; delay: number; emoji: string }[]>([]);
  const before = useRef(feast);
  useEffect(() => {
    const was = before.current;
    before.current = feast;
    if (feast < 100 || was >= 100) return;
    try {
      if (localStorage.getItem(`repas-fete-${mealId}`)) return;
      localStorage.setItem(`repas-fete-${mealId}`, "1");
    } catch {
      // Private window: the party happens anyway.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-off celebration
    setPieces(Array.from({ length: 28 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.8, emoji: ["🧀", "🥔", "🍷", "🎉", "🥖"][i % 5]! })));
    const t = setTimeout(() => setPieces([]), 3600);
    return () => clearTimeout(t);
  }, [feast, mealId]);
  return (
    <>
      {pieces.map((p, i) => (
        <span key={i} aria-hidden className="repas-confetti" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s` }}>
          {p.emoji}
        </span>
      ))}
    </>
  );
}
