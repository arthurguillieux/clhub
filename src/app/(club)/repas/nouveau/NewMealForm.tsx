"use client";

import { useActionState, useState } from "react";
import { createMealAction, type CreateMealState } from "../actions";

const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const IDEAS = ["Soirée raclette", "Fondue", "Barbecue", "Crêpes party", "Apéro dînatoire"];

export function NewMealForm({ suggested }: { suggested: string[] }) {
  const [state, action, pending] = useActionState<CreateMealState, FormData>(createMealAction, { status: "idle" });
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  return (
    <form action={action} className="repas-card flex flex-col gap-4 p-4">
      <label className="flex flex-col gap-1">
        <span className="repas-label">Le potluck</span>
        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required placeholder="Soirée raclette" className="repas-field" />
      </label>
      {!title && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {IDEAS.map((i) => (
            <button key={i} type="button" className="repas-ghost min-h-9 px-3 text-xs" onClick={() => setTitle(i)}>
              {i}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="repas-label">Le jour</span>
          <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required className="repas-field" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="repas-label">L&apos;heure</span>
          <input type="time" name="time" className="repas-field" />
        </label>
      </div>
      {suggested.length > 0 && (
        <div className="-mt-1">
          <p className="repas-muted text-xs">Les jours où tous ceux qui ont branché leur agenda sont libres :</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggested.map((d) => (
              <button key={d} type="button" aria-pressed={date === d} className={date === d ? "repas-btn min-h-9 px-3 text-xs" : "repas-ghost min-h-9 px-3 text-xs"} onClick={() => setDate(d)}>
                {short(d)}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="repas-label">Où</span>
        <input name="place" maxLength={120} placeholder="Chez Marine" className="repas-field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="repas-label">Un mot pour les invités</span>
        <textarea name="note" maxLength={1000} rows={3} placeholder="Ramenez vos pantoufles." className="repas-field py-2" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="open" className="h-5 w-5 accent-[var(--r-herb)]" />
        Ouvert à tout le club (sinon : seulement ceux que tu invites)
      </label>
      <button type="submit" className="repas-btn self-start" disabled={pending}>
        {pending ? "Un instant…" : "Créer le potluck"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-[var(--r-tomato)]">
          {state.message}
        </p>
      )}
    </form>
  );
}
