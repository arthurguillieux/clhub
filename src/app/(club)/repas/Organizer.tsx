"use client";

import Link from "next/link";
import { useState } from "react";
import { parseAmount } from "@/modules/repas/domain/list";
import { TEMPLATES, proposeList, templateOf, type Proposal } from "@/modules/repas/domain/templates";
import type { MealView } from "@/modules/repas/data/meals";
import type { Act } from "./MealScreen";

const fmt = (n: number) => String(n).replace(".", ",");

/** The organizer's corner: the calculator, the guests, the link, and what comes around the meal. */
export function Organizer({ view, busy, act, admin = false }: { view: MealView; busy: boolean; act: Act; admin?: boolean }) {
  return (
    <section className="flex flex-col gap-4 border-t border-[var(--r-line)] pt-5" aria-label="Pour l'organisateur">
      <h2 className="repas-title text-2xl">En cuisine</h2>
      <p className="repas-muted -mt-2 text-sm">Ces outils-là, toi seul les vois.</p>
      <Calculator view={view} busy={busy} act={act} />
      <Guests view={view} busy={busy} act={act} />
      <Around view={view} busy={busy} act={act} admin={admin} />
      <EditInfo view={view} busy={busy} act={act} />
    </section>
  );
}

function Stepper({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" aria-label={`${label} : un de moins`} className="repas-ghost h-10 min-h-10 w-10 px-0" disabled={value === 0} onClick={() => set(value - 1)}>
          −
        </button>
        <b className="w-7 text-center text-lg tabular-nums">{value}</b>
        <button type="button" aria-label={`${label} : un de plus`} className="repas-ghost h-10 min-h-10 w-10 px-0" disabled={value >= 80} onClick={() => set(value + 1)}>
          +
        </button>
      </span>
    </div>
  );
}

/** Végés and non-végés → a base list, adjusted line by line, then added to the meal's list. */
function Calculator({ view, busy, act }: { view: MealView; busy: boolean; act: Act }) {
  const [open, setOpen] = useState(view.items.length === 0);
  const [template, setTemplate] = useState(view.template ?? "raclette");
  const [vege, setVege] = useState(view.counts.vege);
  const [meat, setMeat] = useState(view.counts.meat);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [dropped, setDropped] = useState<string[]>([]);
  const t = templateOf(template)!;
  const base = proposeList(t, { vege, meat });
  const lines = base.filter((p) => !dropped.includes(p.label));
  const final: Proposal[] = lines.flatMap((p) => {
    const raw = edits[p.label];
    if (raw === undefined) return [p];
    const n = parseAmount(raw);
    return n === null ? [] : [{ ...p, quantity: n }];
  });
  const reset = () => {
    setEdits({});
    setDropped([]);
  };

  if (!open)
    return (
      <button type="button" className="repas-ghost self-start" onClick={() => setOpen(true)}>
        🧮 Calculer une liste de courses
      </button>
    );
  return (
    <div className="repas-card flex flex-col gap-4 p-4">
      <div>
        <p className="repas-title text-xl">La calculette</p>
        <p className="repas-muted text-sm">Choisis le repas et le nombre de convives : elle propose une base, à ajuster avant de l&apos;ajouter à la liste.</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ce qu'on mange">
        {TEMPLATES.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={template === x.id}
            className={template === x.id ? "repas-btn px-3 text-sm" : "repas-ghost px-3 text-sm"}
            onClick={() => {
              setTemplate(x.id);
              reset();
            }}
          >
            {x.emoji} {x.name}
          </button>
        ))}
      </div>
      <div className="repas-raised flex flex-col gap-2 p-3">
        <Stepper label="🥩 Non-végés" value={meat} set={(n) => (setMeat(n), reset())} />
        <Stepper label="🥕 Végés" value={vege} set={(n) => (setVege(n), reset())} />
        <p className="repas-muted text-xs">
          D&apos;après les réponses : {view.counts.meat} non-végé{view.counts.meat > 1 ? "s" : ""} et {view.counts.vege} végé{view.counts.vege > 1 ? "s" : ""} (les +1 comptent comme non-végés, les végés viennent des profils).
        </p>
      </div>
      {lines.length === 0 ? (
        <p className="repas-muted text-sm">Personne à table : ajoute des convives.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lines.map((p) => (
            <li key={p.label} className="flex items-center gap-2">
              <span aria-hidden className="w-6 text-center">
                {p.emoji}
              </span>
              <span className="min-w-0 flex-1 text-sm">{p.label}</span>
              <input
                value={edits[p.label] ?? fmt(p.quantity)}
                onChange={(e) => setEdits({ ...edits, [p.label]: e.target.value })}
                inputMode="decimal"
                aria-label={`Quantité de ${p.label}`}
                className="repas-field h-9 min-h-9 w-20 px-2 text-right tabular-nums"
              />
              <span className="repas-muted w-16 text-xs">{p.unit}</span>
              <button type="button" aria-label={`Enlever ${p.label}`} className="repas-muted h-9 w-9 rounded-full" onClick={() => setDropped([...dropped, p.label])}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="repas-btn"
          disabled={busy || final.length === 0}
          onClick={() =>
            void act({ type: "apply", template, proposals: final }).then((e) => {
              if (!e) {
                reset();
                setOpen(false);
              }
            })
          }
        >
          Ajouter ces {final.length} lignes à la liste
        </button>
        {view.items.length > 0 && (
          <button type="button" className="repas-ghost" onClick={() => setOpen(false)}>
            Fermer
          </button>
        )}
      </div>
      {view.items.length > 0 && <p className="repas-muted text-xs">Une ligne qui existe déjà (même nom) prend la nouvelle quantité ; ce que chacun a déjà pris est gardé.</p>}
    </div>
  );
}

function Guests({ view, busy, act }: { view: MealView; busy: boolean; act: Act }) {
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [names, setNames] = useState("");
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const guestNames = new Set(view.guests.filter((g) => g.member).map((g) => g.name));
  const invitable = view.members.filter((m) => !guestNames.has(m.name));
  const typed = names
    .split(/[,\n]/)
    .map((n) => n.trim())
    .filter(Boolean);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(view.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="repas-card flex flex-col gap-3 p-4">
      <p className="repas-title text-xl">Les invités</p>
      <ul className="flex flex-col">
        {view.guests.map((g) => (
          <li key={g.id} className="flex min-h-11 items-center gap-2 border-b border-[var(--r-line)] text-sm last:border-0">
            <span className="flex-1">
              <b>{g.name}</b>
              <span className="repas-muted">
                {" "}
                · {g.status === "yes" ? `vient${g.plusOnes ? ` (+${g.plusOnes})` : ""}` : g.status === "maybe" ? "peut-être" : g.status === "no" ? "ne vient pas" : "pas de réponse"}
                {g.vege ? " · végé" : ""}
                {g.member ? "" : " · sans compte"}
                {g.claims ? ` · ${g.claims} ${g.claims > 1 ? "choses" : "chose"}` : ""}
              </span>
            </span>
            {removing === g.id ? (
              <span className="flex gap-1.5">
                <button type="button" className="repas-danger px-3 text-xs" disabled={busy} onClick={() => void act({ type: "removeGuest", guestId: g.id }).then(() => setRemoving(null))}>
                  Retirer {g.name}
                </button>
                <button type="button" className="repas-ghost px-3 text-xs" onClick={() => setRemoving(null)}>
                  Garder
                </button>
              </span>
            ) : (
              g.id !== view.me?.id && (
                <button type="button" aria-label={`Retirer ${g.name} des invités`} className="repas-muted h-9 w-9 rounded-full" onClick={() => setRemoving(g.id)}>
                  ✕
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      {removing && <p className="repas-muted text-xs">Ce qu&apos;il ou elle ramenait repasse dans « Il manque encore ».</p>}

      {picking ? (
        <div className="repas-raised flex flex-col gap-3 p-3">
          {invitable.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="repas-label mb-1">Des membres du CLHUB</legend>
              <div className="flex flex-wrap gap-1.5">
                {invitable.map((m) => {
                  const on = chosen.includes(m.id);
                  return (
                    <button key={m.id} type="button" aria-pressed={on} className={on ? "repas-btn px-3 text-sm" : "repas-ghost px-3 text-sm"} onClick={() => setChosen(on ? chosen.filter((x) => x !== m.id) : [...chosen, m.id])}>
                      {on ? "✓ " : ""}
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <label className="flex flex-col gap-1">
            <span className="repas-label">Des personnes sans compte</span>
            <input value={names} onChange={(e) => setNames(e.target.value)} placeholder="Léa, Karim…" className="repas-field" />
            <span className="repas-muted text-xs">Sépare les prénoms par des virgules. Envoie-leur ensuite le lien du potluck : ils choisiront leur prénom.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="repas-btn"
              disabled={busy || (chosen.length === 0 && typed.length === 0)}
              onClick={() =>
                void act({ type: "invite", memberIds: chosen, names: typed }).then((e) => {
                  if (!e) {
                    setChosen([]);
                    setNames("");
                    setPicking(false);
                  }
                })
              }
            >
              Inviter {chosen.length + typed.length || ""} {chosen.length + typed.length > 1 ? "personnes" : "personne"}
            </button>
            <button type="button" className="repas-ghost" onClick={() => setPicking(false)}>
              Annuler
            </button>
          </div>
          {chosen.length > 0 && <p className="repas-muted text-xs">Les membres reçoivent une notification (et un mail s&apos;ils l&apos;ont demandé).</p>}
        </div>
      ) : (
        <button type="button" className="repas-btn self-start" onClick={() => setPicking(true)}>
          + Inviter du monde
        </button>
      )}

      <div className="flex flex-col gap-1.5 border-t border-[var(--r-line)] pt-3">
        <p className="repas-label">Le lien du potluck</p>
        <p className="repas-muted text-xs">Pour les invités sans compte : à envoyer par message. Pas besoin de compte pour l&apos;ouvrir.</p>
        <div className="flex gap-2">
          <input readOnly value={view.link} aria-label="Le lien du potluck" className="repas-field min-w-0 flex-1 text-xs" onFocus={(e) => e.target.select()} />
          <button type="button" className="repas-ghost shrink-0" onClick={() => void copy()}>
            {copied ? "Copié ✓" : "Copier le lien"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Around the meal: nudge, the Caisse, do it again, and (admin) delete. */
function Around({ view, busy, act, admin }: { view: MealView; busy: boolean; act: Act; admin: boolean }) {
  const [again, setAgain] = useState(false);
  const [date, setDate] = useState("");
  const [deleting, setDeleting] = useState(false);
  const idle = view.guests.filter((g) => g.member && g.claims === 0 && g.status !== "no" && g.id !== view.me?.id).length;
  return (
    <div className="repas-card flex flex-col gap-3 p-4">
      <p className="repas-title text-xl">Autour du potluck</p>
      <div className="flex flex-col gap-1">
        <button type="button" className="repas-ghost self-start" disabled={busy || idle === 0} onClick={() => void act({ type: "nudge" })}>
          🔔 Relancer ceux qui n&apos;ont rien choisi
        </button>
        <span className="repas-muted text-xs">
          {idle === 0 ? "Tous les membres invités ont choisi quelque chose." : `${idle} ${idle > 1 ? "membres n'ont" : "membre n'a"} encore rien choisi. Les invités sans compte, c'est à toi de leur écrire.`} La veille, un rappel part tout seul.
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {view.caisseEventId ? (
          <Link href={`/caisse/${view.caisseEventId}`} className="repas-ghost self-start">
            💶 Voir la Caisse du potluck
          </Link>
        ) : (
          <button type="button" className="repas-ghost self-start" disabled={busy} onClick={() => void act({ type: "caisse" })}>
            💶 Partager les frais dans la Caisse
          </button>
        )}
        <span className="repas-muted text-xs">Une dépense partagée entre les membres qui viennent (leurs +1 comptent pour eux).</span>
      </div>
      {again ? (
        <form
          className="repas-raised flex flex-wrap items-end gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (date) void act({ type: "duplicate", date });
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="repas-label">Nouvelle date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="repas-field" required />
          </label>
          <button type="submit" className="repas-btn" disabled={busy || !date}>
            Refaire ce potluck
          </button>
          <button type="button" className="repas-ghost" onClick={() => setAgain(false)}>
            Annuler
          </button>
          <p className="repas-muted w-full text-xs">Mêmes invités et même liste, sans les réponses ni qui ramène quoi.</p>
        </form>
      ) : (
        <button type="button" className="repas-ghost self-start" onClick={() => setAgain(true)}>
          🔁 Refaire ce potluck
        </button>
      )}
      {admin &&
        (deleting ? (
          <div className="repas-raised flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className="flex-1">Supprimer « {view.title} », ses invités et sa liste ? C&apos;est définitif.</span>
            <button type="button" className="repas-danger" disabled={busy} onClick={() => void act({ type: "delete" })}>
              Supprimer le potluck
            </button>
            <button type="button" className="repas-ghost" onClick={() => setDeleting(false)}>
              Garder
            </button>
          </div>
        ) : (
          <button type="button" className="repas-danger self-start text-sm" onClick={() => setDeleting(true)}>
            Supprimer ce potluck (admin)
          </button>
        ))}
    </div>
  );
}

function EditInfo({ view, busy, act }: { view: MealView; busy: boolean; act: Act }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: view.title, date: view.date, time: view.time ?? "", place: view.place ?? "", note: view.note ?? "", open: view.open });
  if (!editing)
    return (
      <button type="button" className="repas-ghost self-start" onClick={() => setEditing(true)}>
        ✎ Modifier le titre, la date, le lieu
      </button>
    );
  return (
    <form
      className="repas-card flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void act({ type: "update", ...f }).then((err) => !err && setEditing(false));
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="repas-label">Le potluck</span>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={150} required className="repas-field" />
      </label>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1">
          <span className="repas-label">Le jour</span>
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required className="repas-field" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="repas-label">L&apos;heure</span>
          <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className="repas-field" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="repas-label">Où</span>
        <input value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} maxLength={120} className="repas-field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="repas-label">Un mot pour les invités</span>
        <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={1000} rows={3} className="repas-field py-2" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: e.target.checked })} className="h-5 w-5 accent-[var(--r-herb)]" />
        Ouvert à tout le club (n&apos;importe quel membre peut se joindre)
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="repas-btn" disabled={busy}>
          Enregistrer
        </button>
        <button type="button" className="repas-ghost" onClick={() => setEditing(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}
