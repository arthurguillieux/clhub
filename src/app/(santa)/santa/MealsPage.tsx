"use client";

import Link from "next/link";
import { useState } from "react";
import { DISH_CATEGORIES, DRINK_TYPES, DRINK_UNITS, drinkTotals, headcount, portions, type Presence } from "@/modules/santa/domain/meals";
import type { MealsView } from "@/modules/santa/views";
import type { MealsResult } from "./mealsActions";

type Tab = "repas" | "qui" | "boissons";
type Dish = MealsView["dishes"][number];

const dayName = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const dayLabel = (day: string) => {
  const s = dayName.format(new Date(`${day}T00:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDate();
const NEXT: Record<string, Presence | null> = { none: "x", x: "?", "?": null };
/** Today in France, as the days are written: YYYY-MM-DD. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

const chip = "rounded-full px-2.5 py-0.5 text-xs";
const dietChip = `${chip} bg-[color-mix(in_srgb,var(--s-gold)_16%,transparent)] text-[var(--s-gold)]`;

/**
 * « Qu'est-ce qu'on mange ? »: the meals of a Secret Santa whose organizers turned them on. The same
 * page for a participant (through their link, for themselves) and for an organizer (through the
 * panel, for anyone).
 */
export function MealsPage({ initialView, act, back }: { initialView: MealsView; act: (action: Record<string, unknown>) => Promise<MealsResult>; back: { href: string; label: string } }) {
  const [view, setView] = useState(initialView);
  const [tab, setTab] = useState<Tab>("repas");
  // During the stay, the days already gone start folded: you land on today.
  const [closed, setClosed] = useState<Set<string>>(() => new Set(initialView.days.map((d) => d.day).filter((d) => d < today())));
  const [adding, setAdding] = useState<{ mealId: string; idea: boolean } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forWho, setForWho] = useState(initialView.me ?? initialView.people[0]?.id ?? "");
  const subject = view.organizer ? forWho : view.me;
  const nameOf = new Map(view.people.map((p) => [p.id, p.name]));
  const readOnly = view.archived || !subject;

  async function send(action: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const result = await act(view.organizer ? { participantId: forWho, ...action } : action);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setView(result.view);
      return true;
    } catch {
      setError("Pas de connexion — réessaie.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const allDays = view.days.map((d) => d.day);
  const allClosed = allDays.length > 0 && allDays.every((d) => closed.has(d));
  const toggleDay = (day: string) =>
    setClosed((c) => {
      const next = new Set(c);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link href={back.href} className="-my-2 py-2 text-sm text-[var(--s-muted)] underline hover:text-[var(--s-ink)]">
          ← {back.label}
        </Link>
        <p className="santa-label mt-3">{view.title}</p>
        <h1 className="santa-title mt-1 text-3xl">Qu&apos;est-ce qu&apos;on mange ?</h1>
        {view.note && <p className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--s-gold)_14%,var(--s-surface))] px-3 py-2 text-sm whitespace-pre-wrap text-[var(--s-gold)]">{view.note}</p>}
        {view.archived && <p className="santa-panel mt-3 p-3 text-center text-sm text-[var(--s-gold)]">Ce Secret Santa est terminé : les repas sont gardés en souvenir.</p>}
      </header>

      {view.mine.length > 0 && (
        <section className="santa-panel p-3" aria-label="Ce que j'ai noté">
          <p className="santa-label">Ce que j&apos;ai noté</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">
            {view.mine.map((d) => (
              <li key={d.id}>
                <span className="first-letter:uppercase">
                  {dayName.format(new Date(`${d.day}T00:00:00Z`))} {d.meal}
                </span>{" "}
                : <b>{d.what}</b>
                {d.idea && <span className="text-[var(--s-muted)]"> (idée)</span>}
                {d.hidden && <span className="block text-xs text-[var(--s-gold)]">Ce repas est caché pour l&apos;instant : rien n&apos;est perdu, l&apos;organisation peut le remettre.</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.organizer && !view.archived && (
        <label className="santa-panel flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="text-[var(--s-muted)]">Tu remplis pour</span>
          <select value={forWho} onChange={(e) => setForWho(e.target.value)} className="santa-field min-h-10 flex-1 px-3">
            {view.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === view.me ? " (toi)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div role="tablist" aria-label="Les repas" className="sticky top-2 z-10 grid grid-cols-3 gap-1 rounded-2xl bg-[color-mix(in_srgb,var(--s-surface)_80%,transparent)] p-1 backdrop-blur">
        {(
          [
            ["repas", "Les repas"],
            ["qui", "Qui est là"],
            ["boissons", "Boissons"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${tab === id ? "bg-[var(--s-surface)] text-[var(--s-ink)] shadow" : "text-[var(--s-muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-[var(--s-red)] bg-[color-mix(in_srgb,var(--s-red)_10%,transparent)] px-3 py-2.5 text-sm">
          {error}
        </p>
      )}

      {tab === "repas" && (
        <>
          {view.days.length === 0 ? (
            <p className="santa-panel p-4 text-sm text-[var(--s-muted)]">Aucun repas n&apos;est encore prévu.</p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="santa-note text-sm text-[var(--s-muted)]">
                {view.days.length} jour{view.days.length > 1 ? "s" : ""}
              </span>
              <button type="button" className="santa-btn-ghost min-h-10 px-3 text-sm" onClick={() => setClosed(allClosed ? new Set() : new Set(allDays))}>
                {allClosed ? "Tout déplier" : "Tout replier"}
              </button>
            </div>
          )}
          {view.days.map(({ day, meals }) => {
            const open = !closed.has(day);
            return (
              // One card per day, lunch and dinner inside; while open, its name stays under the tabs as you scroll through it.
              <section key={day} className="santa-panel mt-2">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleDay(day)}
                  className={`flex w-full items-center justify-between gap-3 rounded-[inherit] bg-[var(--s-surface)] px-4 py-3.5 text-left ${open ? "sticky top-[60px] z-[5] rounded-b-none border-b-2 border-[var(--s-line)] shadow-[0_8px_14px_-12px_rgba(23,48,60,0.35)]" : ""}`}
                >
                  <span>
                    <span className="santa-title block text-xl">
                      {dayLabel(day)}
                      {day === today() && <span className="ml-2 inline-block rounded-full bg-[var(--s-red)] px-2 py-0.5 align-[3px] font-sans text-[11px] font-bold tracking-wider text-[var(--s-surface)] uppercase">Aujourd&apos;hui</span>}
                    </span>
                    <span className="text-xs text-[var(--s-muted)]">
                      Couverts : {meals.map((m) => `${m.meal} ${headcount(view.people, m.id).sure}`).join(" · ")}
                    </span>
                  </span>
                  <span aria-hidden="true" className={`text-sm text-[var(--s-muted)] transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}>
                    ▼
                  </span>
                </button>
                {open &&
                  meals.map((m) => (
                    <MealCard
                      key={m.id}
                      meal={m}
                      view={view}
                      nameOf={nameOf}
                      readOnly={readOnly}
                      busy={busy}
                      adding={adding?.mealId === m.id ? adding : null}
                      subject={subject}
                      onAdding={setAdding}
                      send={send}
                    />
                  ))}
              </section>
            );
          })}
        </>
      )}

      {tab === "qui" && <Who view={view} subject={subject} readOnly={readOnly} busy={busy} send={send} />}
      {tab === "boissons" && <Drinks view={view} subject={subject} readOnly={readOnly} busy={busy} nameOf={nameOf} send={send} />}
    </div>
  );
}

function MealCard({
  meal,
  view,
  nameOf,
  readOnly,
  busy,
  adding,
  subject,
  onAdding,
  send,
}: {
  meal: { id: string; meal: string };
  view: MealsView;
  nameOf: Map<string, string>;
  readOnly: boolean;
  busy: boolean;
  adding: { mealId: string; idea: boolean } | null;
  subject: string | null;
  onAdding: (a: { mealId: string; idea: boolean } | null) => void;
  send: (action: Record<string, unknown>) => Promise<boolean>;
}) {
  const { sure, maybe } = headcount(view.people, meal.id);
  const all = view.dishes.filter((d) => d.mealId === meal.id);
  const dishes = all.filter((d) => !d.idea).sort((a, b) => DISH_CATEGORIES.indexOf(a.category as never) - DISH_CATEGORIES.indexOf(b.category as never));
  const ideas = all.filter((d) => d.idea);
  const { parts, unknown } = portions(dishes);
  const veg = dishes.filter((d) => d.veg && d.category === "Plat").length;
  const diets = view.people.filter((p) => p.diet && p.presence[meal.id]);
  const mine = (d: Dish) => !!view.me && (d.who === view.me || d.withId === view.me);
  const subjectBrings = dishes.some((d) => d.who === subject || d.withId === subject);

  return (
    <div className="border-t border-dashed border-[var(--s-line)] p-4 first-of-type:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold capitalize">
          {meal.meal === "midi" ? "☀️" : "🌙"} {meal.meal}
        </h3>
        <span className="font-bold whitespace-nowrap text-[var(--s-green)] tabular-nums">
          {sure} couvert{sure > 1 ? "s" : ""}
          {maybe > 0 && <span className="font-normal text-[var(--s-muted)]"> + {maybe} peut-être</span>}
        </span>
      </div>
      {diets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {diets.map((p) => (
            <span key={p.id} className={dietChip}>
              {p.name} · {p.diet}
            </span>
          ))}
        </div>
      )}
      {dishes.length > 0 ? (
        <ul className="mt-3 flex flex-col divide-y divide-[var(--s-line)]">
          {dishes.map((d) => (
            <li key={d.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-2.5">
              <span className="font-semibold">
                <span className="mr-1.5 text-[11px] font-bold tracking-wider text-[var(--s-red)] uppercase">{d.category}</span>
                {d.what}
                {d.veg && (
                  <span title="Végétarien" aria-label="végétarien">
                    {" "}
                    🌱
                  </span>
                )}
              </span>
              <span className="text-right text-sm text-[var(--s-muted)] tabular-nums">{d.parts ? `${d.parts} parts` : "parts ?"}</span>
              <span className="text-sm text-[var(--s-muted)]">
                {nameOf.get(d.who)}
                {d.withId && nameOf.get(d.withId) ? ` et ${nameOf.get(d.withId)}` : ""}
                {!readOnly && (mine(d) || view.organizer) && (
                  <>
                    {" · "}
                    <button type="button" className="-my-2 py-2 underline" disabled={busy} onClick={() => void send({ type: "removeDish", id: d.id })}>
                      Retirer
                    </button>
                  </>
                )}
              </span>
              {d.note && <span className="col-span-2 text-sm text-[var(--s-muted)] italic">{d.note}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--s-muted)]">Rien de prévu pour l&apos;instant.</p>
      )}
      {dishes.length > 0 && (
        <div className="mt-2 flex items-center gap-2 text-sm text-[var(--s-muted)]">
          <span>
            {parts} parts annoncées{unknown ? " (et des « ? »)" : ""} pour {sure} couvert{sure > 1 ? "s" : ""}
            {veg > 0 && <span className="text-[var(--s-green)]"> · 🌱 {veg} plat{veg > 1 ? "s" : ""} végé</span>}
          </span>
          <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--s-raised)]">
            <span className="block h-full rounded-full bg-[var(--s-green)]" style={{ width: `${Math.min(100, Math.round((parts / Math.max(1, sure)) * 100))}%` }} />
          </span>
        </div>
      )}
      {ideas.map((d) => (
        <div key={d.id} className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-[var(--s-raised)] px-3 py-2">
          <span className="text-sm">
            💡 <b>{d.what}</b> <span className="text-[var(--s-muted)]">· idée de {nameOf.get(d.who)}</span>
          </span>
          {!readOnly && (
            <span className="flex shrink-0 gap-3">
              <button type="button" className="santa-btn-ghost min-h-10 px-3 text-sm" disabled={busy} onClick={() => void send({ type: "takeIdea", id: d.id })}>
                Je m&apos;en charge
              </button>
              {(mine(d) || view.organizer) && (
                <button type="button" className="text-xs text-[var(--s-muted)] underline" disabled={busy} onClick={() => void send({ type: "removeDish", id: d.id })}>
                  Retirer
                </button>
              )}
            </span>
          )}
        </div>
      ))}
      {!readOnly &&
        (adding ? (
          <DishForm key={`${meal.id}-${adding.idea}`} idea={adding.idea} view={view} subject={subject} busy={busy} onCancel={() => onAdding(null)} onSubmit={async (dish) => {
            if (await send({ type: "addDish", mealId: meal.id, ...dish })) onAdding(null);
          }} />
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="santa-btn-ghost min-h-10 px-3 text-sm" onClick={() => onAdding({ mealId: meal.id, idea: false })}>
              {subjectBrings ? "＋ Un autre plat" : view.organizer && subject !== view.me ? `＋ ${view.people.find((p) => p.id === subject)?.name ?? ""} apporte un plat` : "＋ J'apporte un plat"}
            </button>
            <button type="button" className="santa-btn-ghost min-h-10 px-3 text-sm" onClick={() => onAdding({ mealId: meal.id, idea: true })}>
              💡 Une idée
            </button>
          </div>
        ))}
    </div>
  );
}

function DishForm({
  idea,
  view,
  subject,
  busy,
  onCancel,
  onSubmit,
}: {
  idea: boolean;
  view: MealsView;
  subject: string | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (dish: { what: string; category: string; parts: number | null; veg: boolean; note: string; withId: string | null; idea: boolean }) => void;
}) {
  const [what, setWhat] = useState("");
  const [category, setCategory] = useState("Plat");
  const [parts, setParts] = useState("");
  const [veg, setVeg] = useState(false);
  const [note, setNote] = useState("");
  const [withId, setWithId] = useState("");
  return (
    <form
      className="mt-3 flex flex-col gap-2 border-t border-dashed border-[var(--s-line)] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ what, category, parts: parts ? Number(parts) : null, veg, note, withId: withId || null, idea });
      }}
    >
      <p className="text-sm font-semibold">{idea ? "💡 Proposer une idée" : "Ce qui est apporté"}</p>
      {idea && <p className="-mt-1 text-xs text-[var(--s-muted)]">Une idée n&apos;engage personne : quelqu&apos;un pourra dire « Je m&apos;en charge ».</p>}
      <input value={what} onChange={(e) => setWhat(e.target.value)} required maxLength={120} autoFocus aria-label="Le plat" placeholder={idea ? "Une raclette ?" : "Tarte aux champignons"} className="santa-field min-h-11 px-3" />
      <div className="grid grid-cols-2 gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Catégorie" className="santa-field min-h-11 px-3">
          {DISH_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {!idea && <input value={parts} onChange={(e) => setParts(e.target.value)} type="number" min={1} max={200} inputMode="numeric" aria-label="Nombre de parts" placeholder="Parts" className="santa-field min-h-11 px-3" />}
      </div>
      {!idea && (
        <select value={withId} onChange={(e) => setWithId(e.target.value)} aria-label="Avec qui" className="santa-field min-h-11 px-3">
          <option value="">Seul·e</option>
          {view.people
            .filter((p) => p.id !== subject)
            .map((p) => (
              <option key={p.id} value={p.id}>
                avec {p.name}
              </option>
            ))}
        </select>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={veg} onChange={(e) => setVeg(e.target.checked)} className="h-5 w-5" /> 🌱 Végétarien
      </label>
      {!idea && <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Précision" placeholder="Précision (facultatif)" className="santa-field min-h-11 px-3" />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="santa-btn min-h-11 px-4 text-sm" disabled={busy || !what.trim()}>
          {idea ? "Proposer l'idée" : "Ajouter le plat"}
        </button>
        <button type="button" className="santa-btn-ghost min-h-11 px-4 text-sm" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function Who({ view, subject, readOnly, busy, send }: { view: MealsView; subject: string | null; readOnly: boolean; busy: boolean; send: (action: Record<string, unknown>) => Promise<boolean> }) {
  const person = view.people.find((p) => p.id === subject);
  const [diet, setDiet] = useState(person?.diet ?? "");
  const [shownFor, setShownFor] = useState(subject);
  if (shownFor !== subject) {
    setShownFor(subject);
    setDiet(person?.diet ?? "");
  }
  const meals = view.days.flatMap((d) => d.meals.map((m) => ({ ...m, day: d.day })));

  return (
    <>
      {person && !readOnly && (
        <section className="santa-panel p-4">
          <p className="santa-label">{subject === view.me ? "Quand est-ce que tu es là ?" : `Quand ${person.name} est là`}</p>
          <p className="mt-1 text-sm text-[var(--s-muted)]">Touche une case : oui, puis peut-être, puis pas là. Les couverts de chaque repas se comptent tout seuls.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="tabular-nums">
              <thead>
                <tr>
                  {meals.map((m) => (
                    <th key={m.id} className="px-0.5 pb-1 text-center text-xs font-semibold text-[var(--s-muted)]">
                      {shortDay(m.day)}
                      <br />
                      {m.meal}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {meals.map((m) => {
                    const value = person.presence[m.id];
                    return (
                      <td key={m.id} className="px-0.5">
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`${dayLabel(m.day)}, ${m.meal} : ${value === "x" ? "là" : value === "?" ? "peut-être" : "pas là"}`}
                          onClick={() => void send({ type: "presence", mealId: m.id, value: NEXT[value ?? "none"] })}
                          className={`min-h-11 w-11 rounded-xl border text-base font-bold ${
                            value === "x"
                              ? "border-[var(--s-green)] bg-[var(--s-green)] text-[var(--s-surface)]"
                              : value === "?"
                                ? "border-[var(--s-gold)] bg-[color-mix(in_srgb,var(--s-gold)_16%,transparent)] text-[var(--s-gold)]"
                                : "border-[var(--s-line)] bg-[var(--s-raised)]"
                          }`}
                        >
                          {value === "x" ? "✓" : value === "?" ? "?" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm">
              Avec {subject === view.me ? "moi" : person.name}, sans participer au Secret Santa
              <br />
              <span className="text-[var(--s-muted)]">un enfant, un ami de passage…</span>
            </span>
            <span className="flex items-center gap-2">
              <button type="button" className="santa-btn-ghost h-11 w-11" aria-label="Une personne de moins" disabled={busy || person.guests === 0} onClick={() => void send({ type: "profile", diet: person.diet, guests: person.guests - 1 })}>
                −
              </button>
              <b className="w-6 text-center text-[var(--s-green)] tabular-nums">{person.guests}</b>
              <button type="button" className="santa-btn-ghost h-11 w-11" aria-label="Une personne de plus" disabled={busy} onClick={() => void send({ type: "profile", diet: person.diet, guests: person.guests + 1 })}>
                ＋
              </button>
            </span>
          </div>
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send({ type: "profile", diet, guests: person.guests });
            }}
          >
            <label htmlFor="diet" className="text-sm">
              Régime, allergies, intolérances
            </label>
            <div className="flex gap-2">
              <input id="diet" value={diet} onChange={(e) => setDiet(e.target.value)} maxLength={200} placeholder="Rien de particulier" className="santa-field min-h-11 min-w-0 flex-1 px-3" />
              {diet !== person.diet && (
                <button type="submit" className="santa-btn min-h-11 px-4 text-sm" disabled={busy}>
                  Enregistrer
                </button>
              )}
            </div>
          </form>
        </section>
      )}
      <section className="santa-panel p-4">
        <p className="santa-label">Tout le monde</p>
        <ul className="mt-2 flex flex-col divide-y divide-[var(--s-line)]">
          {view.people.map((p) => {
            const sure = meals.filter((m) => p.presence[m.id] === "x").length;
            const maybe = meals.filter((m) => p.presence[m.id] === "?").length;
            return (
              <li key={p.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span>
                  <b>{p.name}</b>
                  {p.guests > 0 && <span className="text-[var(--s-muted)]"> + {p.guests}</span>}
                  {p.diet && (
                    <>
                      <br />
                      <span className={`${dietChip} mt-1 inline-block`}>{p.diet}</span>
                    </>
                  )}
                </span>
                <span className="text-right whitespace-nowrap text-[var(--s-muted)]">{sure + maybe === 0 ? "pas encore répondu" : `${sure} repas${maybe ? ` · ${maybe} ?` : ""}`}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Drinks({
  view,
  subject,
  readOnly,
  busy,
  nameOf,
  send,
}: {
  view: MealsView;
  subject: string | null;
  readOnly: boolean;
  busy: boolean;
  nameOf: Map<string, string>;
  send: (action: Record<string, unknown>) => Promise<boolean>;
}) {
  const [drink, setDrink] = useState<string>(DRINK_TYPES[0]);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<string>(DRINK_UNITS[0]);
  const [what, setWhat] = useState("");
  const totals = drinkTotals(view.drinks);
  // Who brings what, person by person, in the order of the list.
  const byPerson = view.people.map((p) => ({ person: p, drinks: view.drinks.filter((d) => d.who === p.id) })).filter((g) => g.drinks.length > 0);

  return (
    <>
      <section className="santa-panel p-4">
        <p className="santa-label">Au total</p>
        {totals.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--s-muted)]">Personne n&apos;a encore rien prévu à boire.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-[var(--s-line)]">
            {totals.map((t) => (
              <li key={t.type} className="flex justify-between gap-3 py-2 text-sm">
                <span>{t.type}</span>
                <span className="tabular-nums">{t.amounts.map((a) => `${a.quantity} ${a.unit}`).join(" + ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {byPerson.length > 0 && (
        <section className="santa-panel p-4">
          <p className="santa-label">Qui apporte quoi</p>
          <ul className="mt-2 flex flex-col divide-y divide-[var(--s-line)]">
            {byPerson.map(({ person, drinks }) => (
              <li key={person.id} className="py-2.5 text-sm">
                <b>{person.id === view.me ? `${person.name} (toi)` : person.name}</b>
                <ul className="mt-1 flex flex-col gap-1">
                  {drinks.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3">
                      <span>
                        <span className="tabular-nums">
                          {d.quantity} {d.unit}
                        </span>{" "}
                        · {d.type}
                        {d.what && <span className="text-[var(--s-muted)]"> ({d.what})</span>}
                      </span>
                      {!readOnly && (d.who === view.me || view.organizer) && (
                        <button type="button" className="-my-2 py-2 text-xs text-[var(--s-muted)] underline" disabled={busy} onClick={() => void send({ type: "removeDrink", id: d.id })}>
                          Retirer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className={`santa-panel p-4 ${readOnly || !subject ? "hidden" : ""}`}>
        <p className="santa-label">{view.organizer && subject !== view.me ? `Ce que ${nameOf.get(subject ?? "") ?? ""} apporte` : "Ce que tu apportes"}</p>
        {!readOnly && subject && (
          <form
            className="mt-3 flex flex-col gap-2 border-t border-dashed border-[var(--s-line)] pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send({ type: "addDrink", drink, quantity: Number(quantity) || 1, unit, what })) {
                setWhat("");
                setQuantity("1");
              }
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <select value={drink} onChange={(e) => setDrink(e.target.value)} aria-label="Boisson" className="santa-field min-h-11 px-3">
                {DRINK_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input value={what} onChange={(e) => setWhat(e.target.value)} maxLength={120} aria-label="Précision sur la boisson" placeholder="Précision (Bourgueil…)" className="santa-field min-h-11 px-3" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min={1} max={999} inputMode="numeric" aria-label="Combien" className="santa-field min-h-11 px-3" />
              <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unité" className="santa-field min-h-11 px-3">
                {DRINK_UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="santa-btn min-h-11 px-4 text-sm" disabled={busy}>
              {view.organizer && subject !== view.me ? `${nameOf.get(subject)} apporte ça` : "J'apporte ça"}
            </button>
          </form>
        )}
      </section>
      <p className="santa-note mx-auto w-fit text-center text-xs text-[var(--s-muted)]">Les totaux additionnent les mêmes unités : 5 L et 4 bouteilles restent à part.</p>
    </>
  );
}
