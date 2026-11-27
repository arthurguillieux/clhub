"use client";

import { useState } from "react";
import { Card } from "@/core/ui/components/Card";
import { Button } from "@/core/ui/components/Button";
import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { Input, Select, Textarea } from "@/core/ui/components/Field";
import { GroupLabel, SectionTitle } from "@/core/ui/components/Heading";
import { centsForInput, euros } from "@/core/money";
import type { EditionView, ItemRow } from "@/modules/nouvel-an/data";
import { RULES, ruleSentence, type Split } from "@/modules/nouvel-an/domain/plan";
import { deleteEditionAction, nyeOrgAction } from "../actions";
import { ExpenseForm, packs } from "./GuestScreen";
import { ANSWERS, Chip, DayToggles, ErrorLine, Remove, TextButton, dayLabel, useNye, type Run } from "./kit";

type Tab = "invites" | "programme" | "listes" | "budget" | "reglages";
const TABS: { id: Tab; label: string }[] = [
  { id: "invites", label: "Invités" },
  { id: "programme", label: "Programme" },
  { id: "listes", label: "Listes" },
  { id: "budget", label: "Budget" },
  { id: "reglages", label: "Réglages" },
];

type P = { view: EditionView; run: Run; pending: boolean };

/** The organizers' panel: everything can be changed, added, taken away. */
export function OrgPanel({ initialView }: { initialView: EditionView }) {
  const { view, pending, error, run } = useNye(initialView, (input) => nyeOrgAction(initialView.code, input));
  const [tab, setTab] = useState<Tab>("invites");
  return (
    <div className="mt-6 flex flex-col gap-6" aria-busy={pending}>
      <nav aria-label="Organisation" className="sticky top-2 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-full border border-line bg-ground/95 p-1 backdrop-blur">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${tab === t.id ? "bg-primary text-primary-ink" : "text-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <ErrorLine error={error} />
      {tab === "invites" && <Guests view={view} run={run} pending={pending} />}
      {tab === "programme" && (
        <>
          <Meals view={view} run={run} pending={pending} />
          <Tasks view={view} run={run} pending={pending} />
        </>
      )}
      {tab === "listes" && <ListsTab view={view} run={run} pending={pending} />}
      {tab === "budget" && <BudgetTab view={view} run={run} pending={pending} />}
      {tab === "reglages" && <Settings view={view} run={run} pending={pending} />}
    </div>
  );
}

// ───────── Invités ─────────

function Guests({ view, run, pending }: P) {
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const count = (a: string) => view.guests.filter((g) => g.answer === a).length;
  const notInvited = view.guests.filter((g) => !g.invited && g.token !== view.me?.token).length;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="ok">{count("yes")} viennent</Chip>
        <Chip tone="warn">{count("maybe")} peut-être</Chip>
        <Chip>{count("pending")} sans réponse</Chip>
        <Chip>{count("no")} ne viennent pas</Chip>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending || notInvited === 0} onClick={() => void run({ type: "invite", guestIds: null })}>
          {notInvited ? `Envoyer les invitations (${notInvited})` : "Tout le monde est invité"}
        </Button>
        {view.me && (
          <a href={`/nouvel-an/${view.me.token}`} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
            Voir ma page d&apos;invité
          </a>
        )}
      </div>
      <p className="text-sm text-muted">Chacun reçoit son lien perso (sans compte) pour répondre : s&apos;il vient, quels jours, son option, son régime.</p>

      <Card className="divide-y divide-line-soft">
        {view.guests.map((g) => (
          <GuestRow key={g.id} view={view} run={run} pending={pending} guest={g} />
        ))}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <GroupLabel>Ajouter</GroupLabel>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ type: "addMember", memberId })) setMemberId("");
          }}
        >
          <Select aria-label="Un membre du CLHUB" value={memberId} onChange={(e) => setMemberId(e.target.value)} className="min-w-48 flex-1">
            <option value="">Un membre du CLHUB…</option>
            {view.invitable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="ghost" disabled={pending || !memberId}>
            Ajouter le membre
          </Button>
        </form>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ type: "addEmail", name, email })) {
              setName("");
              setEmail("");
            }
          }}
        >
          <Input aria-label="Prénom de l'invité" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom" className="w-36!" maxLength={60} />
          <Input aria-label="Adresse mail de l'invité" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="son@adresse.fr" className="min-w-48 flex-1" />
          <Button type="submit" variant="ghost" disabled={pending || !name.trim() || !email.trim()}>
            Ajouter par mail
          </Button>
        </form>
      </Card>
    </section>
  );
}

function GuestRow({ view, run, pending, guest: g }: P & { guest: EditionView["guests"][number] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const option = view.options.find((o) => o.id === g.optionId);
  return (
    <div className="px-4 py-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <span className="min-w-0">
          <span className="block font-semibold text-ink">{g.name}</span>
          <span className="block text-xs text-muted">
            {g.isMember ? "membre" : g.email} · {ANSWERS.find((a) => a.id === g.answer)?.short}
            {g.days ? ` · ${g.days.map(dayLabel).join(", ")}` : ""}
            {option ? ` · ${option.label}` : ""}
            {g.diet ? ` · ${g.diet}` : ""}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {g.mailError ? <Chip tone="bad">mail non parti</Chip> : g.invited ? <Chip>invité·e</Chip> : null}
          {g.paidDeclared && <Chip tone="ok">dit avoir payé</Chip>}
        </span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <Select aria-label={`Réponse de ${g.name}`} value={g.answer} disabled={pending} onChange={(e) => void run({ type: "answer", guestId: g.id, answer: e.target.value })} className="w-56!">
            {ANSWERS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
          {view.days.length > 1 && <DayToggles days={view.days} value={g.days} disabled={pending} onChange={(days) => void run({ type: "answer", guestId: g.id, days })} />}
          {view.options.length > 0 && (
            <Select aria-label={`Option de ${g.name}`} value={g.optionId ?? ""} disabled={pending} onChange={(e) => void run({ type: "answer", guestId: g.id, optionId: e.target.value || null })} className="w-64!">
              <option value="">Sans option</option>
              {view.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} · {euros(o.priceCents)}
                </option>
              ))}
            </Select>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {g.token && (
              <TextButton
                onClick={async () => {
                  await navigator.clipboard?.writeText(`${window.location.origin}/nouvel-an/${g.token}`);
                  setCopied(true);
                }}
              >
                {copied ? "Lien copié ✓" : "Copier son lien perso"}
              </TextButton>
            )}
            {g.token !== view.me?.token && (
              <TextButton disabled={pending} onClick={() => void run({ type: "invite", guestIds: [g.id] })}>
                {g.invited ? "Renvoyer l'invitation" : "Envoyer l'invitation"}
              </TextButton>
            )}
            {g.token !== view.me?.token && <Remove label="Retirer de la liste" confirmLabel={`Retirer ${g.name}`} onConfirm={() => void run({ type: "removeGuest", guestId: g.id })} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Programme ─────────

function Meals({ view, run, pending }: P) {
  const [day, setDay] = useState(view.days[0] ?? "");
  const [label, setLabel] = useState("");
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Les repas</SectionTitle>
      {view.days.map((d) => {
        const meals = view.meals.filter((m) => m.day === d);
        if (!meals.length) return null;
        return (
          <Card key={d} className="flex flex-col gap-3 p-4">
            <GroupLabel>{dayLabel(d)}</GroupLabel>
            {meals.map((m) => (
              <MealRow key={m.id} meal={m} run={run} pending={pending} />
            ))}
          </Card>
        );
      })}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run({ type: "meal", id: null, day, label, menu: "" })) setLabel("");
        }}
      >
        <Select aria-label="Jour du repas" value={day} onChange={(e) => setDay(e.target.value)} className="w-40!">
          {view.days.map((d) => (
            <option key={d} value={d}>
              {dayLabel(d)}
            </option>
          ))}
        </Select>
        <Input aria-label="Nom du repas" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Apéro, Brunch…" className="w-40!" maxLength={60} />
        <Button type="submit" variant="ghost" disabled={pending || !label.trim()}>
          Ajouter un repas
        </Button>
      </form>
    </section>
  );
}

function MealRow({ meal, run, pending }: { meal: EditionView["meals"][number]; run: Run; pending: boolean }) {
  const [label, setLabel] = useState(meal.label);
  const [menu, setMenu] = useState(meal.menu);
  const dirty = label !== meal.label || menu !== meal.menu;
  return (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-3 first-of-type:border-0 first-of-type:pt-0">
      <Input aria-label="Nom du repas" value={label} onChange={(e) => setLabel(e.target.value)} className="font-semibold" maxLength={60} />
      <Textarea aria-label={`Menu : ${meal.label}`} value={menu} onChange={(e) => setMenu(e.target.value)} placeholder="Le menu, qui cuisine…" className="min-h-16" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" disabled={pending || !dirty || !label.trim()} onClick={() => void run({ type: "meal", id: meal.id, day: meal.day, label, menu }, "Repas enregistré")}>
          Enregistrer
        </Button>
        <Remove label="Retirer ce repas" confirmLabel={`Retirer « ${meal.label} »`} onConfirm={() => void run({ type: "removeMeal", id: meal.id })} />
      </div>
    </div>
  );
}

const STATUS = { todo: "À faire", doing: "En cours", done: "Fait" } as const;

function Tasks({ view, run, pending }: P) {
  const poles = [...new Set(view.tasks.map((t) => t.pole))];
  const [pole, setPole] = useState(poles[0] ?? "Coordination");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Qui fait quoi</SectionTitle>
      <p className="text-sm text-muted">Les invités voient les missions et peuvent dire « je m&apos;en charge ».</p>
      {poles.map((p) => (
        <Card key={p} className="flex flex-col p-4">
          <GroupLabel>{p}</GroupLabel>
          <ul className="mt-2 divide-y divide-line-soft">
            {view.tasks
              .filter((t) => t.pole === p)
              .map((t) => (
                <TaskRow key={t.id} view={view} run={run} pending={pending} task={t} />
              ))}
          </ul>
        </Card>
      ))}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run({ type: "task", id: null, pole, title, due, status: "todo", note: "" })) {
            setTitle("");
            setDue("");
          }
        }}
      >
        <Input aria-label="Pôle de la mission" list="nye-poles" value={pole} onChange={(e) => setPole(e.target.value)} placeholder="Pôle" className="w-40!" maxLength={60} />
        <datalist id="nye-poles">
          {poles.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Input aria-label="Nouvelle mission" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Une mission" className="min-w-48 flex-1" maxLength={200} />
        <Input aria-label="Échéance" value={due} onChange={(e) => setDue(e.target.value)} placeholder="Échéance" className="w-36!" maxLength={60} />
        <Button type="submit" variant="ghost" disabled={pending || !title.trim() || !pole.trim()}>
          Ajouter la mission
        </Button>
      </form>
    </section>
  );
}

function TaskRow({ view, run, pending, task: t }: P & { task: EditionView["tasks"][number] }) {
  const [who, setWho] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [due, setDue] = useState(t.due);
  const [pole, setPole] = useState(t.pole);
  const name = new Map(view.guests.map((g) => [g.id, g.name]));
  const free = view.guests.filter((g) => g.answer !== "no" && !t.guestIds.includes(g.id));
  return (
    <li className="flex flex-col gap-2 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`min-h-10 text-left text-sm font-semibold ${t.status === "done" ? "text-muted line-through" : "text-ink"}`}>
          {t.title}
          {t.due && <span className="font-normal text-muted"> · {t.due}</span>}
        </button>
        <Select aria-label={`Avancement : ${t.title}`} value={t.status} disabled={pending} onChange={(e) => void run({ type: "taskStatus", taskId: t.id, status: e.target.value })} className="w-32!">
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {t.guestIds.map((id) => (
          <button key={id} type="button" disabled={pending} onClick={() => void run({ type: "takeTask", taskId: t.id, guestId: id, on: false })} aria-label={`Retirer ${name.get(id)} de la mission`} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2.5 text-xs font-semibold text-ink">
            {name.get(id)} <span aria-hidden>×</span>
          </button>
        ))}
        <Select
          aria-label={`Ajouter quelqu'un : ${t.title}`}
          value={who}
          disabled={pending}
          onChange={async (e) => {
            setWho(e.target.value);
            if (e.target.value && (await run({ type: "takeTask", taskId: t.id, guestId: e.target.value, on: true }))) setWho("");
          }}
          className="w-44!"
        >
          <option value="">+ quelqu&apos;un</option>
          {free.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Pôle" value={pole} onChange={(e) => setPole(e.target.value)} className="w-36!" maxLength={60} />
          <Input aria-label="Mission" value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-48 flex-1" maxLength={200} />
          <Input aria-label="Échéance" value={due} onChange={(e) => setDue(e.target.value)} className="w-32!" maxLength={60} />
          <Button type="button" variant="ghost" disabled={pending || !title.trim() || !pole.trim()} onClick={async () => (await run({ type: "task", id: t.id, pole, title, due, status: t.status, note: t.note })) && setOpen(false)}>
            Enregistrer
          </Button>
          <Remove label="Retirer la mission" confirmLabel={`Retirer « ${t.title} »`} onConfirm={() => void run({ type: "removeTask", id: t.id })} />
        </div>
      )}
    </li>
  );
}

// ───────── Listes ─────────

function ListsTab({ view, run, pending }: P) {
  const [name, setName] = useState("");
  const hc = view.headcount;
  return (
    <section className="flex flex-col gap-4">
      <Card className="p-4 text-sm">
        <p className="text-ink">
          Calculé pour <strong>{hc.people} personne{hc.people > 1 ? "s" : ""}</strong>
          {hc.overridden ? " (le nombre fixé dans Réglages)" : " (ceux qui ont dit oui)"} sur {hc.days} jour{hc.days > 1 ? "s" : ""} et {hc.meals} repas
          {!hc.overridden && hc.personDays !== hc.people * hc.days ? `, soit ${hc.personDays} journées de présence` : ""}.
        </p>
        <p className="mt-1 text-muted">Chaque article suit sa règle (par personne, par jour, par repas), moins ce qui reste en stock, arrondi au lot. « Ajuster » garde ton chiffre.</p>
      </Card>
      {view.lists.map((l) => (
        <ListCard key={l.id} view={view} run={run} pending={pending} list={l} />
      ))}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run({ type: "list", id: null, name, split: "presence" })) setName("");
        }}
      >
        <Input aria-label="Nouvelle liste" value={name} onChange={(e) => setName(e.target.value)} placeholder="Une nouvelle liste (Petit-déj…)" className="min-w-48 flex-1" maxLength={60} />
        <Button type="submit" variant="ghost" disabled={pending || !name.trim()}>
          Ajouter la liste
        </Button>
      </form>
    </section>
  );
}

const SPLIT_LABEL: Record<Split, string> = { presence: "selon les jours de présence", equal: "à parts égales", options: "selon l'option de chacun" };

function ListCard({ view, run, pending, list: l }: P & { list: EditionView["lists"][number] }) {
  const [adding, setAdding] = useState(false);
  const [rename, setRename] = useState(false);
  const [name, setName] = useState(l.name);
  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        {rename ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run({ type: "list", id: l.id, name, split: l.split })) setRename(false);
            }}
          >
            <Input aria-label="Nom de la liste" value={name} onChange={(e) => setName(e.target.value)} className="w-48!" maxLength={60} />
            <Button type="submit" variant="ghost" disabled={pending || !name.trim()}>
              Renommer
            </Button>
          </form>
        ) : (
          <button type="button" onClick={() => setRename(true)} className="font-display text-lg font-extrabold text-ink">
            {l.name}
          </button>
        )}
        <span className="font-semibold tabular-nums text-ink">{euros(l.totalCents)}</span>
      </div>
      <ul className="divide-y divide-line-soft">
        {l.items.map((it) => (
          <ItemLine key={it.id} view={view} run={run} pending={pending} item={it} listId={l.id} />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-line-soft px-4 py-3">
        {adding ? (
          <ItemForm run={run} pending={pending} listId={l.id} onDone={() => setAdding(false)} />
        ) : (
          <Button type="button" variant="ghost" onClick={() => setAdding(true)}>
            Ajouter un article
          </Button>
        )}
        <Select aria-label={`Partage : ${l.name}`} value={l.split} disabled={pending} onChange={(e) => void run({ type: "list", id: l.id, name: l.name, split: e.target.value })} className="w-60!">
          <option value="presence">Payé {SPLIT_LABEL.presence}</option>
          <option value="equal">Payé {SPLIT_LABEL.equal}</option>
        </Select>
        <Remove label="Retirer la liste" confirmLabel={`Retirer « ${l.name} » et ses articles`} onConfirm={() => void run({ type: "removeList", id: l.id })} />
      </div>
    </Card>
  );
}

function ItemLine({ view, run, pending, item: it, listId }: P & { item: ItemRow; listId: string }) {
  const [edit, setEdit] = useState(false);
  const name = new Map(view.guests.map((g) => [g.id, g.name.split(" ")[0]]));
  const adjusted = it.overridePacks !== null && it.overridePacks !== it.need.computedPacks;
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setEdit(!edit)} aria-expanded={edit} className="min-h-10 min-w-0 text-left">
          <span className={`block text-sm font-semibold ${it.bought ? "text-muted line-through" : "text-ink"}`}>
            {it.name} · {packs(it)}
          </span>
          <span className="block text-xs text-muted">
            {ruleSentence(it.rule, it.ratio)}
            {it.rule !== "fixed" ? ` → ${it.need.units.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${it.unit ? ` ${it.unit}` : ""}` : ""}
            {it.stock > 0 ? ` · ${it.stock} en stock` : ""}
            {adjusted ? ` · ajusté (calcul : ${it.need.computedPacks})` : ""}
            {it.guestId ? ` · ${name.get(it.guestId) ?? "?"} s'en occupe` : ""}
          </span>
        </button>
        <span className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-ink">{it.need.costCents === null ? "—" : euros(it.need.costCents)}</span>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={it.bought} disabled={pending} onChange={(e) => void run({ type: "itemBought", itemId: it.id, bought: e.target.checked })} className="h-5 w-5!" />
            acheté
          </label>
        </span>
      </div>
      {edit && (
        <div className="mt-2 flex flex-col gap-3">
          <ItemForm run={run} pending={pending} listId={listId} item={it} onDone={() => setEdit(false)} />
          <div className="flex flex-wrap items-center gap-3">
            <Select aria-label={`Qui s'occupe de : ${it.name}`} value={it.guestId ?? ""} disabled={pending} onChange={(e) => void run({ type: "takeItem", itemId: it.id, guestId: e.target.value || null, on: !!e.target.value })} className="w-48!">
              <option value="">Personne en charge</option>
              {view.guests
                .filter((g) => g.answer !== "no")
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </Select>
            <Remove label="Retirer l'article" confirmLabel={`Retirer « ${it.name} »`} onConfirm={() => void run({ type: "removeItem", id: it.id })} />
          </div>
        </div>
      )}
    </li>
  );
}

function ItemForm({ run, pending, listId, item, onDone }: { run: Run; pending: boolean; listId: string; item?: ItemRow; onDone: () => void }) {
  const [f, setF] = useState({
    name: item?.name ?? "",
    rule: item?.rule ?? "person_day",
    ratio: item ? String(item.ratio).replace(".", ",") : "1",
    unit: item?.unit ?? "",
    perPack: String(item?.perPack ?? 1),
    price: item?.packPriceCents != null ? centsForInput(item.packPriceCents) : "",
    stock: item ? String(item.stock).replace(".", ",") : "0",
    override: item?.overridePacks != null ? String(item.overridePacks) : "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const field = "flex flex-col gap-1 text-xs text-muted";
  return (
    <form
      className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run({ type: "item", id: item?.id ?? null, listId, name: f.name, rule: f.rule, ratio: f.ratio, unit: f.unit, perPack: f.perPack, packPriceCents: f.price, stock: f.stock, overridePacks: f.override }, item ? "Article enregistré" : "Article ajouté")) onDone();
      }}
    >
      <label className={`${field} col-span-2`}>
        Article
        <Input value={f.name} onChange={set("name")} maxLength={60} placeholder="Bières" />
      </label>
      <label className={field}>
        Quantité
        <Input value={f.ratio} onChange={set("ratio")} inputMode="decimal" />
      </label>
      <label className={field}>
        Règle
        <Select value={f.rule} onChange={set("rule")}>
          {RULES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </Select>
      </label>
      <label className={field}>
        Unité
        <Input value={f.unit} onChange={set("unit")} maxLength={60} placeholder="canette 25 cl" />
      </label>
      <label className={field}>
        Unités par lot
        <Input value={f.perPack} onChange={set("perPack")} inputMode="numeric" />
      </label>
      <label className={field}>
        Prix du lot (€)
        <Input value={f.price} onChange={set("price")} inputMode="decimal" placeholder="10,29" />
      </label>
      <label className={field}>
        Déjà en stock (unités)
        <Input value={f.stock} onChange={set("stock")} inputMode="decimal" />
      </label>
      <label className={field}>
        Ajuster (lots)
        <Input value={f.override} onChange={set("override")} inputMode="numeric" placeholder="le calcul" />
      </label>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-3">
        <Button type="submit" disabled={pending || !f.name.trim()}>
          {item ? "Enregistrer" : "Ajouter"}
        </Button>
        <TextButton onClick={onDone}>Annuler</TextButton>
      </div>
    </form>
  );
}

// ───────── Budget ─────────

function BudgetTab({ view, run, pending }: P) {
  const b = view.budget;
  const payers = view.guests.filter((g) => g.answer === "yes");
  const owing = b.accounts.filter((a) => a.balanceCents > 0);
  const toRemind = owing.filter((a) => !view.guests.find((g) => g.id === a.guestId)?.paidDeclared);
  return (
    <section className="flex flex-col gap-6">
      <div>
        <SectionTitle>Les postes</SectionTitle>
        <p className="mt-1 text-sm text-muted">Une dépense réelle notée sur un poste remplace sa prévision dans les parts.</p>
        <Card className="mt-3 divide-y divide-line-soft">
          {b.lines.map((l) => {
            const cost = l.key.startsWith("cost:") ? view.costs.find((c) => `cost:${c.id}` === l.key) : null;
            return cost ? (
              <CostLine key={l.key} run={run} pending={pending} cost={cost} realCents={l.realCents} />
            ) : (
              <div key={l.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold text-ink">{l.label}</span>
                  <span className="block text-xs text-muted">
                    {l.key === "other" ? "dépenses sans poste" : `la liste · ${SPLIT_LABEL[l.split]}`}
                    {l.realCents !== null && l.key !== "other" ? ` · prévu ${euros(l.estimateCents)}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">
                  {euros(l.amountCents)}
                  {l.realCents !== null && <span className="ml-1 text-xs text-muted">réel</span>}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between px-4 py-3 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{euros(b.totalCents)}</span>
          </div>
        </Card>
        <NewCost run={run} pending={pending} />
      </div>

      <Options view={view} run={run} pending={pending} />

      <div>
        <SectionTitle>Les parts et les paiements</SectionTitle>
        <p className="mt-1 text-sm text-muted">
          {payers.length} personne{payers.length > 1 ? "s" : ""} paient. Moyenne : {payers.length ? euros(Math.round(b.totalCents / payers.length)) : "—"}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" disabled={pending || !owing.length} onClick={() => void run({ type: "payMails", kind: "request" })}>
            {view.requestSentAt ? "Renvoyer la demande de participation" : "Envoyer la demande de participation"}
          </Button>
          <Button type="button" variant="ghost" disabled={pending || !toRemind.length} onClick={() => void run({ type: "payMails", kind: "reminder" })}>
            Relancer ceux qui n&apos;ont pas payé ({toRemind.length})
          </Button>
        </div>
        {!view.paymentInfo && <p className="mt-2 text-sm text-muted">Écris d&apos;abord comment payer dans Réglages (« Wero au 06… »).</p>}
        <Card className="mt-3 divide-y divide-line-soft">
          {b.accounts.map((a) => (
            <AccountLine key={a.guestId} view={view} run={run} pending={pending} account={a} />
          ))}
          {!b.accounts.length && <p className="px-4 py-3 text-sm text-muted">Les parts apparaîtront quand des invités auront dit oui.</p>}
        </Card>
      </div>

      <div>
        <SectionTitle>Les dépenses avancées</SectionTitle>
        <Card className="mt-3 divide-y divide-line-soft">
          {view.expenses.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <span className="font-semibold text-ink">{view.guests.find((g) => g.id === x.guestId)?.name}</span> · {x.label}
                <span className="text-muted"> · {b.lines.find((l) => l.key === x.lineKey)?.label ?? "autre"}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{euros(x.cents)}</span>
                <TextButton disabled={pending} onClick={() => void run({ type: "removeExpense", id: x.id })}>
                  Retirer
                </TextButton>
              </span>
            </div>
          ))}
          <div className="px-4 py-3">
            <ExpenseForm view={view} run={run} pending={pending} who={view.guests.map((g) => ({ id: g.id, name: g.name }))} />
          </div>
        </Card>
      </div>
    </section>
  );
}

function CostLine({ run, pending, cost, realCents }: { run: Run; pending: boolean; cost: EditionView["costs"][number]; realCents: number | null }) {
  const [label, setLabel] = useState(cost.label);
  const [amount, setAmount] = useState(centsForInput(cost.cents));
  const [split, setSplit] = useState<Split>(cost.split);
  const dirty = label !== cost.label || amount !== centsForInput(cost.cents) || split !== cost.split;
  return (
    <form
      className="flex flex-wrap items-center gap-2 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ type: "cost", id: cost.id, label, cents: amount, split }, "Poste enregistré");
      }}
    >
      <Input aria-label="Poste" value={label} onChange={(e) => setLabel(e.target.value)} className="min-w-36 flex-1 font-semibold" maxLength={60} />
      <Input aria-label={`Prévision : ${cost.label}`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-28!" />
      <Select aria-label={`Partage : ${cost.label}`} value={split} onChange={(e) => setSplit(e.target.value as Split)} className="w-56!">
        {(Object.keys(SPLIT_LABEL) as Split[]).map((s) => (
          <option key={s} value={s}>
            {SPLIT_LABEL[s]}
          </option>
        ))}
      </Select>
      {realCents !== null && <Chip tone="warn">réel : {euros(realCents)}</Chip>}
      {dirty && (
        <Button type="submit" variant="ghost" disabled={pending || !label.trim()}>
          Enregistrer
        </Button>
      )}
      <Remove label="Retirer" confirmLabel={`Retirer « ${cost.label} »`} onConfirm={() => void run({ type: "removeCost", id: cost.id })} />
    </form>
  );
}

function NewCost({ run, pending }: { run: Run; pending: boolean }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run({ type: "cost", id: null, label, cents: amount, split: "equal" })) {
          setLabel("");
          setAmount("");
        }
      }}
    >
      <Input aria-label="Nouveau poste" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Un poste (la boulangerie…)" className="min-w-48 flex-1" maxLength={60} />
      <Input aria-label="Montant prévu" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" className="w-28!" />
      <Button type="submit" variant="ghost" disabled={pending || !label.trim()}>
        Ajouter le poste
      </Button>
    </form>
  );
}

function Options({ view, run, pending }: P) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const o = view.budget.options;
  return (
    <div>
      <SectionTitle>Les options</SectionTitle>
      <p className="mt-1 text-sm text-muted">Des façons de participer à des prix différents (chambre seule, chambre partagée…). Elles paient le poste partagé « selon l&apos;option de chacun ».</p>
      {o && (
        <p className={`mt-2 text-sm ${o.collectedCents < o.costCents ? "text-ink" : "text-muted"}`}>
          Les options rapportent {euros(o.collectedCents)} pour {euros(o.costCents)}
          {o.collectedCents < o.costCents ? ` : il manque ${euros(o.costCents - o.collectedCents)}.` : o.collectedCents > o.costCents ? ` : ${euros(o.collectedCents - o.costCents)} de trop.` : " : le compte est bon."}
        </p>
      )}
      <Card className="mt-3 divide-y divide-line-soft">
        {view.options.map((opt) => (
          <OptionLine key={opt.id} run={run} pending={pending} option={opt} count={view.guests.filter((g) => g.answer === "yes" && g.optionId === opt.id).length} />
        ))}
        <form
          className="flex flex-wrap gap-2 px-4 py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ type: "option", id: null, label, priceCents: price })) {
              setLabel("");
              setPrice("");
            }
          }}
        >
          <Input aria-label="Nouvelle option" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bâtiment A, chambre double" className="min-w-48 flex-1" maxLength={60} />
          <Input aria-label="Prix de l'option" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="76,00" inputMode="decimal" className="w-28!" />
          <Button type="submit" variant="ghost" disabled={pending || !label.trim()}>
            Ajouter l&apos;option
          </Button>
        </form>
      </Card>
    </div>
  );
}

function OptionLine({ run, pending, option, count }: { run: Run; pending: boolean; option: EditionView["options"][number]; count: number }) {
  const [label, setLabel] = useState(option.label);
  const [price, setPrice] = useState(centsForInput(option.priceCents));
  return (
    <form
      className="flex flex-wrap items-center gap-2 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ type: "option", id: option.id, label, priceCents: price }, "Option enregistrée");
      }}
    >
      <Input aria-label="Option" value={label} onChange={(e) => setLabel(e.target.value)} className="min-w-48 flex-1" maxLength={60} />
      <Input aria-label={`Prix : ${option.label}`} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="w-28!" />
      <Chip>{count} choisi{count > 1 ? "s" : ""}</Chip>
      {(label !== option.label || price !== centsForInput(option.priceCents)) && (
        <Button type="submit" variant="ghost" disabled={pending}>
          Enregistrer
        </Button>
      )}
      <Remove label="Retirer" confirmLabel={`Retirer « ${option.label} »`} onConfirm={() => void run({ type: "removeOption", id: option.id })} />
    </form>
  );
}

function AccountLine({ view, run, pending, account: a }: P & { account: EditionView["budget"]["accounts"][number] }) {
  const g = view.guests.find((x) => x.id === a.guestId);
  const [received, setReceived] = useState(centsForInput(a.receivedCents));
  if (!g) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{g.name}</span>
        <span className="block text-xs text-muted">
          part {euros(a.dueCents)}
          {a.advancedCents ? ` · a avancé ${euros(a.advancedCents)}` : ""}
          {g.paidDeclared ? " · dit avoir payé" : ""}
          {g.reminded ? " · relancé·e" : ""}
        </span>
      </span>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ type: "received", guestId: g.id, cents: received }, "Paiement noté");
        }}
      >
        <Input aria-label={`Reçu de ${g.name}`} value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" className="w-24!" />
        <Button type="submit" variant="ghost" disabled={pending || received === centsForInput(a.receivedCents)}>
          Reçu
        </Button>
        {a.balanceCents > 0 && !a.receivedCents && (
          <TextButton disabled={pending} onClick={() => void run({ type: "received", guestId: g.id, cents: centsForInput(a.dueCents - a.advancedCents) }, "Paiement noté")}>
            Tout reçu
          </TextButton>
        )}
        <span className={`w-28 text-right font-semibold tabular-nums ${a.balanceCents > 0 ? "text-ink" : "text-muted"}`}>{a.balanceCents > 0 ? `reste ${euros(a.balanceCents)}` : a.balanceCents < 0 ? `à rendre ${euros(-a.balanceCents)}` : "réglé ✓"}</span>
      </form>
    </div>
  );
}

// ───────── Réglages ─────────

function Settings({ view, run, pending }: P) {
  const [s, setS] = useState({ title: view.title, startsOn: view.startsOn, endsOn: view.endsOn, place: view.place, message: view.message, paymentInfo: view.paymentInfo, headcountOverride: view.headcountOverride ? String(view.headcountOverride) : "" });
  const [cohost, setCohost] = useState("");
  const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value });
  const field = "flex flex-col gap-1.5 text-sm text-muted";
  return (
    <section className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ type: "settings", ...s }, "Réglages enregistrés");
        }}
      >
        <label className={field}>
          Titre
          <Input value={s.title} onChange={set("title")} maxLength={80} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            Du
            <Input type="date" value={s.startsOn} onChange={set("startsOn")} />
          </label>
          <label className={field}>
            Au
            <Input type="date" value={s.endsOn} onChange={set("endsOn")} />
          </label>
        </div>
        <label className={field}>
          Où
          <Input value={s.place} onChange={set("place")} maxLength={200} placeholder="Chez Marine et Arthur" />
        </label>
        <label className={field}>
          Le mot aux invités
          <Textarea value={s.message} onChange={set("message")} maxLength={2000} placeholder="Ramenez vos duvets !" />
        </label>
        <label className={field}>
          Comment payer
          <Input value={s.paymentInfo} onChange={set("paymentInfo")} maxLength={200} placeholder="Wero au 06 12 34 56 78 (Justine)" />
        </label>
        <label className={field}>
          Calculer les listes pour (personnes)
          <Input value={s.headcountOverride} onChange={set("headcountOverride")} inputMode="numeric" placeholder={`ceux qui ont dit oui (${view.guests.filter((g) => g.answer === "yes").length})`} className="w-56!" />
        </label>
        <Button type="submit" disabled={pending} className="self-start">
          Enregistrer les réglages
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        <SectionTitle>Les organisateurs</SectionTitle>
        <p className="text-sm text-muted">
          {view.hostName}
          {view.cohosts.length ? `, ${view.cohosts.map((c) => c.name).join(", ")}` : ""} : ils modifient tout.
        </p>
        {view.isHost && (
          <>
            {view.cohosts.map((c) => (
              <div key={c.memberId} className="flex items-center justify-between text-sm">
                {c.name}
                <TextButton disabled={pending} onClick={() => void run({ type: "cohost", memberId: c.memberId, on: false })}>
                  Retirer
                </TextButton>
              </div>
            ))}
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run({ type: "cohost", memberId: cohost, on: true })) setCohost("");
              }}
            >
              <Select aria-label="Co-organisateur" value={cohost} onChange={(e) => setCohost(e.target.value)} className="min-w-48 flex-1">
                <option value="">Un membre invité…</option>
                {view.guests
                  .filter((g) => g.isMember && g.token !== view.me?.token)
                  .map((g) => (
                    <option key={g.id} value={memberOf(view, g.id)}>
                      {g.name}
                    </option>
                  ))}
              </Select>
              <Button type="submit" variant="ghost" disabled={pending || !cohost}>
                Ajouter aux organisateurs
              </Button>
            </form>
          </>
        )}
      </div>

      {view.isHost && (
        <div className="border-t border-line-soft pt-4">
          <ConfirmDeleteButton triggerLabel="Supprimer ce nouvel an" question={`Supprimer « ${view.title} », ses invités, ses listes et son budget ? On ne peut pas revenir en arrière.`} confirmLabel="Supprimer le nouvel an" onConfirm={() => deleteEditionAction(view.code)} />
        </div>
      )}
    </section>
  );
}

const memberOf = (view: EditionView, guestId: string) => view.memberIds[guestId] ?? "";

