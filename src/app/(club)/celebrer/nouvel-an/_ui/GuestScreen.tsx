"use client";

import { useState } from "react";
import { Card } from "@/core/ui/components/Card";
import { Button } from "@/core/ui/components/Button";
import { Input, Select } from "@/core/ui/components/Field";
import { SectionTitle } from "@/core/ui/components/Heading";
import { euros } from "@/core/money";
import type { EditionView } from "@/modules/nouvel-an/data";
import { nyeGuestAction } from "../actions";
import { ANSWERS, Choice, DayToggles, ErrorLine, TextButton, dayLabel, useNye, type Run } from "./kit";

/**
 * A guest's page (through their personal link, or a member's own page in the club), in the order
 * things happen: am I coming, what I owe, the programme, who does what, the lists, who's coming.
 */
export function GuestScreen({ token, initialView }: { token: string; initialView: EditionView }) {
  const { view, pending, error, run } = useNye(initialView, (input) => nyeGuestAction(token, input));
  const me = view.guests.find((g) => g.id === view.me?.guestId);
  if (!me) return null;
  return (
    <div className="mt-6 flex flex-col gap-8" aria-busy={pending}>
      <ErrorLine error={error} />
      <MyAnswer view={view} run={run} pending={pending} />
      {me.answer === "yes" && <MyPart view={view} run={run} pending={pending} />}
      <Programme view={view} />
      <Missions view={view} run={run} pending={pending} />
      <Lists view={view} run={run} pending={pending} />
      <WhoComes view={view} />
    </div>
  );
}

function MyAnswer({ view, run, pending }: { view: EditionView; run: Run; pending: boolean }) {
  const me = view.guests.find((g) => g.id === view.me?.guestId)!; // the page exists only for a guest
  const [diet, setDiet] = useState(me.diet);
  return (
    <section>
      <SectionTitle>Et toi ?</SectionTitle>
      <div className="mt-3 flex flex-col gap-4">
        <Choice label="Ta réponse" value={me.answer} options={ANSWERS.filter((a) => a.id !== "pending")} disabled={pending} onChange={(answer) => void run({ type: "answer", answer }, answer === "yes" ? "Super, à bientôt !" : "C'est noté")} />
        {me.answer !== "no" && (
          <>
            {view.days.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-muted">Les jours où tu es là :</p>
                <DayToggles days={view.days} value={me.days} disabled={pending} onChange={(days) => void run({ type: "answer", days })} />
              </div>
            )}
            {view.options.length > 0 && (
              <label className="flex flex-col gap-1.5 text-sm text-muted">
                Ton option
                <Select value={me.optionId ?? ""} disabled={pending} onChange={(e) => void run({ type: "answer", optionId: e.target.value || null })}>
                  <option value="">Choisis…</option>
                  {view.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label} · {euros(o.priceCents)}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run({ type: "answer", diet }, "C'est noté pour les menus");
              }}
            >
              <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm text-muted">
                Régime, allergies, ce que tu ne manges pas
                <Input value={diet} onChange={(e) => setDiet(e.target.value)} maxLength={200} placeholder="Sans gluten, végétarien…" />
              </label>
              <Button type="submit" variant="ghost" disabled={pending || diet === me.diet}>
                Enregistrer
              </Button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function MyPart({ view, run, pending }: { view: EditionView; run: Run; pending: boolean }) {
  const me = view.guests.find((g) => g.id === view.me?.guestId)!; // shown for the guest only
  const acc = view.budget.accounts.find((a) => a.guestId === me.id);
  const lineLabel = new Map(view.budget.lines.map((l) => [l.key, l.label]));
  const mine = view.expenses.filter((x) => x.guestId === me.id);
  return (
    <section>
      <SectionTitle>Ta participation</SectionTitle>
      <Card className="mt-3 flex flex-col gap-4 p-5">
        {!acc || acc.dueCents === 0 ? (
          <p className="text-sm text-muted">Le budget n&apos;est pas encore prêt : ta part s&apos;affichera ici.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1 text-sm">
              {Object.entries(acc.parts).map(([key, c]) => (
                <li key={key} className="flex justify-between gap-3">
                  <span className="text-muted">{lineLabel.get(key) ?? key}</span>
                  <span className="tabular-nums text-ink">{euros(c)}</span>
                </li>
              ))}
              <li className="mt-1 flex justify-between gap-3 border-t border-line-soft pt-2 font-semibold">
                <span>Ta part</span>
                <span className="tabular-nums">{euros(acc.dueCents)}</span>
              </li>
              {acc.advancedCents > 0 && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted">Ce que tu as avancé</span>
                  <span className="tabular-nums">− {euros(acc.advancedCents)}</span>
                </li>
              )}
              {acc.receivedCents > 0 && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted">Déjà reçu par les orgas</span>
                  <span className="tabular-nums">− {euros(acc.receivedCents)}</span>
                </li>
              )}
            </ul>
            <p className="font-display text-2xl font-extrabold text-ink">
              {acc.balanceCents > 0 ? `Reste à verser : ${euros(acc.balanceCents)}` : acc.balanceCents < 0 ? `On te doit ${euros(-acc.balanceCents)}` : "Tout est réglé ✓"}
            </p>
            {acc.balanceCents > 0 && view.paymentInfo && <p className="text-sm whitespace-pre-wrap text-ink">💸 {view.paymentInfo}</p>}
            {acc.balanceCents > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {me.paidDeclared ? (
                  <>
                    <span className="text-sm text-ink">✓ Tu as dit avoir payé : les orgas vont vérifier.</span>
                    <TextButton disabled={pending} onClick={() => void run({ type: "declarePaid", paid: false })}>
                      Finalement non
                    </TextButton>
                  </>
                ) : (
                  <Button type="button" disabled={pending} onClick={() => void run({ type: "declarePaid", paid: true }, "Merci ! Les orgas sont prévenus sur leur page")}>
                    J&apos;ai payé
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer py-2 font-semibold text-ink">J&apos;ai avancé de l&apos;argent pour le nouvel an…</summary>
          <div className="mt-2 flex flex-col gap-3">
            {mine.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-3">
                <span>
                  {x.label} <span className="text-muted">· {x.lineKey ? lineLabel.get(x.lineKey) : "autre"}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{euros(x.cents)}</span>
                  <TextButton disabled={pending} onClick={() => void run({ type: "removeExpense", id: x.id })}>
                    Retirer
                  </TextButton>
                </span>
              </div>
            ))}
            <ExpenseForm view={view} run={run} pending={pending} />
          </div>
        </details>
      </Card>
    </section>
  );
}

/** Money advanced: what, how much, for which line of the budget. An organizer also says who. */
export function ExpenseForm({ view, run, pending, who }: { view: EditionView; run: Run; pending: boolean; who?: { id: string; name: string }[] }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [line, setLine] = useState("");
  const [guestId, setGuestId] = useState("");
  const lines = view.budget.lines.filter((l) => l.key !== "other");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run({ type: "addExpense", label, cents: amount, lineKey: line || null, ...(who ? { guestId } : {}) }, "Dépense notée : elle compte dans les parts")) {
          setLabel("");
          setAmount("");
        }
      }}
    >
      {who && (
        <Select aria-label="Qui a payé" value={guestId} onChange={(e) => setGuestId(e.target.value)} className="w-40!" required>
          <option value="">Qui a payé ?</option>
          {who.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      )}
      <Input aria-label="Ce que c'était" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Les courses du Drive" className="min-w-40 flex-1" maxLength={200} />
      <Input aria-label="Montant payé" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="97,89" inputMode="decimal" className="w-28!" />
      <Select aria-label="Pour quoi" value={line} onChange={(e) => setLine(e.target.value)} className="w-44!">
        <option value="">Pour quoi ?</option>
        {lines.map((l) => (
          <option key={l.key} value={l.key}>
            {l.label}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="ghost" disabled={pending || !label.trim() || !amount.trim() || (!!who && !guestId)}>
        Noter la dépense
      </Button>
    </form>
  );
}

export function Programme({ view }: { view: EditionView }) {
  if (!view.meals.length) return null;
  return (
    <section>
      <SectionTitle>Le programme</SectionTitle>
      <div className="mt-3 flex flex-col gap-3">
        {view.days.map((d) => {
          const meals = view.meals.filter((m) => m.day === d);
          if (!meals.length) return null;
          return (
            <Card key={d} className="p-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{dayLabel(d)}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {meals.map((m) => (
                  <li key={m.id}>
                    <span className="font-semibold text-ink">{m.label}</span>
                    {m.menu && <p className="text-sm whitespace-pre-wrap text-muted">{m.menu}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

const STATUS = { todo: "À faire", doing: "En cours", done: "Fait" } as const;

function Missions({ view, run, pending }: { view: EditionView; run: Run; pending: boolean }) {
  const me = view.me?.guestId;
  const name = new Map(view.guests.map((g) => [g.id, g.name.split(" ")[0]]));
  const poles = [...new Set(view.tasks.map((t) => t.pole))];
  if (!poles.length) return null;
  return (
    <section>
      <SectionTitle>Qui fait quoi</SectionTitle>
      <p className="mt-1 text-sm text-muted">Une mission te tente ? « Je m&apos;en charge ».</p>
      <div className="mt-3 flex flex-col gap-3">
        {poles.map((p) => (
          <Card key={p} className="p-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{p}</p>
            <ul className="mt-2 divide-y divide-line-soft">
              {view.tasks
                .filter((t) => t.pole === p)
                .map((t) => {
                  const mine = !!me && t.guestIds.includes(me);
                  return (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${t.status === "done" ? "text-muted line-through" : "text-ink"}`}>{t.title}</span>
                        <span className="block text-xs text-muted">
                          {t.guestIds.length ? t.guestIds.map((id) => name.get(id)).join(", ") : "personne pour l'instant"}
                          {t.due ? ` · ${t.due}` : ""} · {STATUS[t.status]}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {mine && (
                          <Select aria-label={`Avancement : ${t.title}`} value={t.status} disabled={pending} onChange={(e) => void run({ type: "taskStatus", taskId: t.id, status: e.target.value })} className="w-32!">
                            {Object.entries(STATUS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </Select>
                        )}
                        <Button type="button" variant="ghost" disabled={pending} onClick={() => void run({ type: "takeTask", taskId: t.id, on: !mine }, mine ? "Tu n'es plus sur cette mission" : "Merci ! C'est noté")}>
                          {mine ? "Je me retire" : "Je m'en charge"}
                        </Button>
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Lists({ view, run, pending }: { view: EditionView; run: Run; pending: boolean }) {
  const me = view.me?.guestId;
  const name = new Map(view.guests.map((g) => [g.id, g.name.split(" ")[0]]));
  if (!view.lists.length) return null;
  return (
    <section>
      <SectionTitle>Les listes</SectionTitle>
      <p className="mt-1 text-sm text-muted">Calculées pour {view.headcount.people} personne{view.headcount.people > 1 ? "s" : ""}. Tu peux te proposer pour en ramener une partie.</p>
      <div className="mt-3 flex flex-col gap-3">
        {view.lists.map((l) => (
          <details key={l.id} className="rounded-xl border border-line bg-surface">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 font-semibold text-ink">
              {l.name}
              <span className="text-sm font-normal text-muted">{l.items.filter((it) => it.need.packs > 0).length} articles</span>
            </summary>
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {l.items
                .filter((it) => it.need.packs > 0)
                .map((it) => {
                  const mine = !!me && it.guestId === me;
                  return (
                    <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                      <span className="min-w-0 text-sm">
                        <span className={`font-semibold ${it.bought ? "text-muted line-through" : "text-ink"}`}>{it.name}</span>{" "}
                        <span className="text-muted">
                          · {packs(it)}
                          {it.guestId && !mine ? ` · ${name.get(it.guestId) ?? "?"} s'en occupe` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {mine && (
                          <label className="flex items-center gap-1.5 text-sm">
                            <input type="checkbox" checked={it.bought} disabled={pending} onChange={(e) => void run({ type: "itemBought", itemId: it.id, bought: e.target.checked })} className="h-5 w-5!" />
                            acheté
                          </label>
                        )}
                        {(!it.guestId || mine) && (
                          <TextButton disabled={pending} onClick={() => void run({ type: "takeItem", itemId: it.id, on: !mine }, mine ? undefined : "Merci ! C'est noté")}>
                            {mine ? "Je laisse" : "Je m'en occupe"}
                          </TextButton>
                        )}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

/** « 10 × canette 25 cl (lot de 20) », said simply. */
export function packs(it: EditionView["lists"][number]["items"][number]): string {
  const n = it.need.packs;
  if (it.perPack > 1) return `${n} lot${n > 1 ? "s" : ""} de ${it.perPack}${it.unit ? ` (${it.unit})` : ""}`;
  return `${n}${it.unit ? ` × ${it.unit}` : ""}`;
}

function WhoComes({ view }: { view: EditionView }) {
  const coming = view.guests.filter((g) => g.answer === "yes");
  const maybe = view.guests.filter((g) => g.answer === "maybe");
  return (
    <section>
      <SectionTitle>Qui vient</SectionTitle>
      <p className="mt-2 text-sm text-ink">
        {coming.length ? coming.map((g) => g.name.split(" ")[0]).join(", ") : "Personne n'a encore dit oui."}
        {maybe.length ? <span className="text-muted"> · peut-être : {maybe.map((g) => g.name.split(" ")[0]).join(", ")}</span> : null}
      </p>
    </section>
  );
}
