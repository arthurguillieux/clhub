"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { daysBetween } from "@/modules/santa/domain/meals";
import { SANTA_THEMES, type SantaTheme } from "@/modules/santa/themes";
import type { OrgParticipant, OrgView } from "@/modules/santa/views";
import { de } from "@/modules/santa/words";
import { deleteSantaAction, santaNextYearAction, santaOrgAction, santaUnmaskAction } from "../../actions";
import { SantaDialog } from "../../SantaDialog";

type Dialog = { title: string; detail?: string; confirmLabel?: string; cancelLabel: string; danger?: boolean; onConfirm?: () => void };

const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function OrgPanel({
  code,
  initialView,
  isCreator,
  members,
}: {
  code: string;
  initialView: OrgView;
  /** The creator picks co-organizers and can delete the event; co-organizers can do everything else. */
  isCreator: boolean;
  members: { id: string; name: string; isHost: boolean }[];
}) {
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);

  async function send(action: Record<string, unknown>, label = "…"): Promise<boolean> {
    setBusy(label);
    setError("");
    try {
      const result = await santaOrgAction(code, action);
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
      setBusy(null);
    }
  }

  const askUnmask = (p: OrgParticipant) =>
    setDialog({
      title: `Démasquer le tirage ${de(p.name)} ?`,
      detail: "Tu vas voir à qui cette personne offre son cadeau. C'est prévu pour les urgences (un désistement, une personne perdue…), et ça restera noté ici, visible des autres organisateurs.",
      confirmLabel: `Oui, démasquer ${p.name}`,
      cancelLabel: "Garder le secret",
      danger: true,
      onConfirm: async () => {
        const result = await santaUnmaskAction(code, p.id).catch(() => ({ ok: false as const, error: "Pas de connexion — réessaie." }));
        if (!result.ok) return setError(result.error);
        setView(result.view);
        setDialog({ title: `${p.name} offre à ${result.recipient}`, detail: "Garde ça pour toi !", cancelLabel: "J'ai vu, fermer" });
      },
    });

  const launched = view.status === "launched";
  const opened = view.participants.filter((p) => p.revealed).length;
  const failed = view.participants.filter((p) => p.mailError).length;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Link href="/jeux/santa" className="text-sm text-[var(--s-muted)] hover:text-[var(--s-ink)]">
          ← Secret Santa
        </Link>
        <p className="santa-label mt-3">
          {launched ? "Tirage effectué" : "Préparation"} · code {code}
          {!isCreator && " · co-organisation"}
        </p>
        <h1 className="santa-title mt-1 text-3xl">{view.title}</h1>
        {view.previousTitle && !launched && <p className="mt-1 text-sm text-[var(--s-muted)]">Le tirage évitera de refaire celui de « {view.previousTitle} ».</p>}
        {launched && (
          <p className="mt-2 text-sm text-[var(--s-muted)]">
            <b className="text-[var(--s-green)]">
              {opened} / {view.participants.length}
            </b>{" "}
            ont ouvert leur cadeau{failed > 0 && <span className="text-[var(--s-red)]"> · {failed} mail(s) à renvoyer</span>}
          </p>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-[var(--s-red)] bg-[rgba(255,59,78,0.1)] px-3 py-2.5 text-sm">
          {error}
        </p>
      )}

      <Settings
        view={view}
        busy={!!busy}
        isCreator={isCreator}
        onSave={(s) => send({ type: "settings", ...s })}
        onTheme={(theme) => void send({ type: "theme", theme })}
        onPassword={(password) => send({ type: "cohostPassword", password })}
        onMeals={(meals) => send({ type: "mealsSettings", ...meals })}
        onToggleMeal={(id) => void send({ type: "toggleMeal", id })}
      />

      <Participants
        view={view}
        members={members}
        busy={!!busy}
        onAddMember={(memberId) => send({ type: "addMember", memberId })}
        onAddGuest={(name, email) => send({ type: "addGuest", name, email })}
        onUpdateGuest={(id, name, email) => send({ type: "updateGuest", id, name, email })}
        onRemove={(id) => send({ type: "removeParticipant", id })}
        onResend={(id) => send({ type: "resend", id })}
        onUnmask={askUnmask}
      />

      {(!launched || view.exclusions.length > 0) && (
        <Exclusions
          view={view}
          busy={!!busy}
          onAdd={(fromId, toId, mutual) => send({ type: "addExclusion", fromId, toId, mutual })}
          onRemove={(id) => send({ type: "removeExclusion", id })}
        />
      )}

      {isCreator && (
        <Cohosts
          view={view}
          members={members.filter((m) => !m.isHost)}
          busy={!!busy}
          onAdd={(memberId) => send({ type: "addCohost", memberId })}
          onRemove={(memberId) => send({ type: "removeCohost", memberId })}
        />
      )}

      {view.unmasks.length > 0 && (
        <section className="santa-panel p-4">
          <p className="santa-label">Traces de démasquage</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-[var(--s-muted)]">
            {view.unmasks.map((u, i) => (
              <li key={i}>
                {u.who} a regardé le tirage {de(u.whom)} · {clock.format(new Date(u.at))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {launched && (
        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            className="santa-btn min-h-12 px-4"
            disabled={!!busy}
            onClick={() =>
              setDialog({
                title: "Archiver ce Secret Santa ?",
                detail: "À faire une fois les cadeaux échangés. Il passe dans tes archives, d'où tu pourras le refaire l'année suivante. Les pages perso restent lisibles, mais on ne peut plus y écrire.",
                confirmLabel: "Archiver",
                cancelLabel: "Pas maintenant",
                onConfirm: async () => {
                  if (await send({ type: "archive", archived: true })) window.location.href = `/santa/${code}/archive`;
                },
              })
            }
          >
            📦 Archiver
          </button>
          <button
            type="button"
            className="santa-btn-ghost min-h-12 px-4"
            disabled={!!busy}
            onClick={() =>
              setDialog({
                title: "Revenir à la préparation ?",
                detail:
                  "Pour changer la liste ou les exclusions, par exemple après un désistement. Le tirage est annulé, les questions anonymes effacées, et un nouveau lancement refera le tirage et renverra un mail à tout le monde. Les lettres au Père Noël sont gardées.",
                confirmLabel: "Annuler le tirage",
                cancelLabel: "Garder le tirage",
                danger: true,
                onConfirm: () => void send({ type: "backToPreparation" }),
              })
            }
          >
            ↺ Revenir à la préparation
          </button>
        </section>
      )}

      <button
        type="button"
        className="santa-btn-ghost min-h-12 px-4"
        disabled={!!busy}
        onClick={() =>
          setDialog({
            title: "Dupliquer ce Secret Santa ?",
            detail: `Un nouveau Secret Santa est créé, en préparation, avec les mêmes participants, exclusions, réglages et co-organisateurs. ${launched ? "Son tirage évitera les duos de celui-ci, qui ne change pas." : "Celui-ci ne change pas."}`,
            confirmLabel: "Dupliquer",
            cancelLabel: "Annuler",
            onConfirm: () => {
              setBusy("…");
              void santaNextYearAction(code);
            },
          })
        }
      >
        📄 Dupliquer
      </button>

      {isCreator && (
        <button
          type="button"
          className="santa-btn-ghost min-h-12 px-4 text-[var(--s-red)]"
          onClick={() =>
            setDialog({
              title: "Supprimer ce Secret Santa ?",
              detail: "Participants, tirage, lettres et questions sont effacés définitivement. Les liens envoyés ne marcheront plus.",
              confirmLabel: "Supprimer définitivement",
              cancelLabel: "Garder",
              danger: true,
              onConfirm: () => void deleteSantaAction(code),
            })
          }
        >
          Supprimer ce Secret Santa
        </button>
      )}

      {!launched && (
        <div className="santa-bar fixed inset-x-0 bottom-0 z-40 px-4 py-3">
          <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
            <button
              type="button"
              className="santa-btn min-h-12 px-4"
              disabled={!!busy || !!view.blocker}
              onClick={() =>
                setDialog({
                  title: "Lancer le tirage ?",
                  detail: `Le tirage se fait maintenant et ${view.participants.length} mails partent, chacun avec son lien perso. Personne ne verra le résultat, pas même toi${
                    view.previousTitle ? `, et il évitera celui de « ${view.previousTitle} »` : ""
                  }.`,
                  confirmLabel: "Tirer au sort et envoyer les mails",
                  cancelLabel: "Pas encore",
                  onConfirm: () => void send({ type: "launch" }, "Envoi des mails…"),
                })
              }
            >
              {busy === "Envoi des mails…" ? busy : "🎁 Lancer le tirage et envoyer les mails"}
            </button>
            {view.blocker && <p className="text-center text-xs text-[var(--s-gold)]">{view.blocker}</p>}
          </div>
        </div>
      )}

      {dialog && <SantaDialog {...dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Settings({
  view,
  busy,
  isCreator,
  onSave,
  onTheme,
  onPassword,
  onMeals,
  onToggleMeal,
}: {
  view: OrgView;
  busy: boolean;
  isCreator: boolean;
  onSave: (s: { title: string; budget: string; exchangeDate: string | null; message: string }) => Promise<boolean>;
  onTheme: (theme: SantaTheme) => void;
  onPassword: (password: string | null) => Promise<boolean>;
  onMeals: (meals: { enabled: boolean; from: string | null; to: string | null; note: string }) => Promise<boolean>;
  onToggleMeal: (id: string) => void;
}) {
  const [title, setTitle] = useState(view.title);
  const [budget, setBudget] = useState(view.budget);
  const [date, setDate] = useState(view.exchangeDate ?? "");
  const [message, setMessage] = useState(view.message);
  const changed = title !== view.title || budget !== view.budget || date !== (view.exchangeDate ?? "") || message !== view.message;
  return (
    <details className="santa-panel p-4" open={view.status === "preparation"}>
      <summary className="cursor-pointer font-bold">⚙️ Réglages</summary>
      <div className="mt-3 flex flex-col gap-3">
        <label className="text-sm text-[var(--s-muted)]">
          Nom
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="santa-field mt-1 block min-h-11 w-full px-3" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-[var(--s-muted)]">
            Budget conseillé
            <input value={budget} onChange={(e) => setBudget(e.target.value)} maxLength={60} placeholder="20 €" className="santa-field mt-1 block min-h-11 w-full px-3" />
          </label>
          <label className="text-sm text-[var(--s-muted)]">
            Échange des cadeaux
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="santa-field mt-1 block min-h-11 w-full px-3 [color-scheme:dark]" />
          </label>
        </div>
        <label className="text-sm text-[var(--s-muted)]">
          Un mot pour les participants
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Rendez-vous le 24 chez nous, cadeaux au pied du sapin !"
            className="santa-field mt-1 block w-full px-3 py-2"
          />
        </label>
        {changed && (
          <button
            type="button"
            className="santa-btn min-h-11 self-start px-4 text-sm"
            disabled={busy || !title.trim()}
            onClick={() => void onSave({ title, budget, exchangeDate: date || null, message })}
          >
            Enregistrer les réglages
          </button>
        )}
        <div role="radiogroup" aria-label="Thème" className="text-sm text-[var(--s-muted)]">
          Thème
          <div className="mt-1 grid grid-cols-2 gap-2">
            {SANTA_THEMES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={view.theme === t.id} disabled={busy} onClick={() => view.theme !== t.id && onTheme(t.id)} className="santa-theme p-2 text-left">
                <span aria-hidden="true" className={`santa-swatch santa-swatch-${t.id}`} />
                <span className="mt-1.5 block font-semibold text-[var(--s-ink)]">{t.name}</span>
                <span className="block text-xs">{t.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <Meals view={view} busy={busy} onMeals={onMeals} onToggleMeal={onToggleMeal} />
        {isCreator && <Access view={view} busy={busy} onPassword={onPassword} />}
      </div>
    </details>
  );
}

const mealDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** « 🍽️ Les repas »: off by default, can be turned on even after the draw; everyone then finds it on their page. */
function Meals({
  view,
  busy,
  onMeals,
  onToggleMeal,
}: {
  view: OrgView;
  busy: boolean;
  onMeals: (meals: { enabled: boolean; from: string | null; to: string | null; note: string }) => Promise<boolean>;
  onToggleMeal: (id: string) => void;
}) {
  const m = view.meals;
  const [from, setFrom] = useState(m.from ?? "");
  const [to, setTo] = useState(m.to ?? "");
  const [note, setNote] = useState(m.note);
  // Before hiding what someone already wrote: asked once, with what's on it.
  const [ask, setAsk] = useState<{ kind: "toggle"; id: string; text: string } | { kind: "range"; text: string } | null>(null);
  const changed = from !== (m.from ?? "") || to !== (m.to ?? "") || note !== m.note;
  const days = [...new Set(m.slots.map((s) => s.day))];
  const label = (s: { day: string; meal: string }) => `${mealDay.format(new Date(`${s.day}T00:00:00Z`))} ${s.meal}`;
  const written = (s: { dishes: number; answers: number }) =>
    [s.dishes ? `${s.dishes} plat${s.dishes > 1 ? "s" : ""}` : "", s.answers ? `${s.answers} réponse${s.answers > 1 ? "s" : ""} (qui est là)` : ""].filter(Boolean).join(" et ");
  const save = () => onMeals({ enabled: m.enabled || !m.from, from: from || null, to: to || null, note }).then(() => setAsk(null));
  const trySave = () => {
    const kept = new Set(from && to ? daysBetween(from, to) : []);
    const dropped = m.slots.filter((s) => !s.off && (s.dishes || s.answers) && !kept.has(s.day));
    if (dropped.length) setAsk({ kind: "range", text: `Avec ces dates, ${dropped.map((s) => `${label(s)} (${written(s)})`).join(", ")} ne ser${dropped.length > 1 ? "ont" : "a"} plus visible${dropped.length > 1 ? "s" : ""}. Rien n'est effacé : en remettant les dates, tout revient.` });
    else void save();
  };
  const tryToggle = (s: (typeof m.slots)[number]) => {
    if (!s.off && (s.dishes || s.answers)) setAsk({ kind: "toggle", id: s.id, text: `Sur ${label(s)}, il y a déjà ${written(s)}. En retirant ce repas, tout le monde ne le verra plus. Rien n'est effacé : en le remettant, tout revient.` });
    else onToggleMeal(s.id);
  };
  // A hidden day comes back by widening the dates around it.
  const widen = (day: string) => {
    const f = !m.from || day < m.from ? day : m.from;
    const t = !m.to || day > m.to ? day : m.to;
    setFrom(f);
    setTo(t);
    void onMeals({ enabled: true, from: f, to: t, note: m.note });
  };
  return (
    <div className="border-t border-[var(--s-line)] pt-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm">
          <b>🍽️ Les repas</b>
          <br />
          <span className="text-[var(--s-muted)]">Pour organiser qui apporte quoi quand vous êtes réunis plusieurs jours. Tout le monde le retrouve sur sa page, même après le tirage.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={m.enabled}
          aria-label="Activer les repas"
          disabled={busy || view.archived}
          onClick={() => void onMeals({ enabled: !m.enabled, from: m.from ?? (from || null), to: m.to ?? (to || null), note: m.note })}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${m.enabled ? "bg-[var(--s-green)]" : "bg-[var(--s-line)]"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] motion-reduce:transition-none ${m.enabled ? "left-7" : "left-1"}`} />
        </button>
      </div>
      {(m.enabled || !m.from) && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-[var(--s-muted)]">
              Premier jour
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="santa-field mt-1 block min-h-11 w-full px-3" />
            </label>
            <label className="text-sm text-[var(--s-muted)]">
              Dernier jour
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="santa-field mt-1 block min-h-11 w-full px-3" />
            </label>
          </div>
          <label className="text-sm text-[var(--s-muted)]">
            Un mot pour tout le monde
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Celui ou celle qui prépare gère les courses, la cuisine et la vaisselle."
              className="santa-field mt-1 block w-full px-3 py-2"
            />
          </label>
          {changed && (
            <button type="button" className="santa-btn min-h-11 self-start px-4 text-sm" disabled={busy || !from || !to} onClick={trySave}>
              {m.from ? "Enregistrer les repas" : "Activer les repas sur ces dates"}
            </button>
          )}
          {ask && (
            <div role="alertdialog" aria-label="Des choses sont déjà notées" className="rounded-xl border border-[var(--s-gold)] bg-[color-mix(in_srgb,var(--s-gold)_10%,var(--s-surface))] p-3 text-sm">
              <p>{ask.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="santa-btn min-h-10 px-3 text-sm"
                  disabled={busy}
                  onClick={() => {
                    if (ask.kind === "toggle") {
                      onToggleMeal(ask.id);
                      setAsk(null);
                    } else void save();
                  }}
                >
                  {ask.kind === "toggle" ? "Retirer ce repas quand même" : "Enregistrer ces dates quand même"}
                </button>
                <button type="button" className="santa-btn-ghost min-h-10 px-3 text-sm" onClick={() => setAsk(null)}>
                  {ask.kind === "toggle" ? "Garder ce repas" : "Revoir les dates"}
                </button>
              </div>
            </div>
          )}
          {m.enabled && days.length > 0 && (
            <div>
              <p className="text-sm text-[var(--s-muted)]">Les repas à prévoir (touche pour en retirer un)</p>
              <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1.5 text-sm">
                {days.map((day) => (
                  <Fragment key={day}>
                    <span className="first-letter:uppercase">{mealDay.format(new Date(`${day}T00:00:00Z`))}</span>
                    {m.slots
                      .filter((s) => s.day === day)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={!s.off}
                          disabled={busy}
                          onClick={() => tryToggle(s)}
                          className={`min-h-9 rounded-full border px-3 text-xs capitalize ${s.off ? "border-[var(--s-line)] text-[var(--s-muted)] line-through" : "border-[var(--s-green)] bg-[var(--s-green)] text-[var(--s-surface)]"}`}
                        >
                          {s.meal}
                        </button>
                      ))}
                  </Fragment>
                ))}
              </div>
            </div>
          )}
          {m.enabled && m.hidden.length === 0 && (
            <p className="rounded-xl border border-[var(--s-line)] p-3 text-sm text-[var(--s-muted)]" aria-label="Noté sur des repas cachés">
              <b className="text-[var(--s-ink)]">Noté sur des repas cachés :</b> rien. Aucun repas retiré ni aucun jour hors des dates ne cache de plat ou de réponse : tout ce qui est noté est visible sur la page des repas.
            </p>
          )}
          {m.enabled && m.hidden.length > 0 && (
            <div className="rounded-xl border border-[var(--s-line)] p-3" aria-label="Noté sur des repas cachés">
              <p className="text-sm font-semibold">Noté sur des repas cachés</p>
              <p className="text-xs text-[var(--s-muted)]">Personne ne les voit en ce moment. Rien n&apos;est effacé : remets le repas pour que tout revienne.</p>
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {m.hidden.map((h) => (
                  <li key={h.id} className="flex flex-col gap-1.5">
                    <span>
                      <b className="first-letter:uppercase">{label(h)}</b>
                      <span className="text-[var(--s-muted)]"> · {h.outOfRange ? "hors des dates" : "repas retiré"}</span>
                    </span>
                    {h.dishes.length > 0 && (
                      <span className="text-[var(--s-muted)]">
                        {h.dishes.map((d) => `${d.who} : ${d.what}`).join(" · ")}
                      </span>
                    )}
                    {h.answers > 0 && <span className="text-[var(--s-muted)]">{h.answers} réponse{h.answers > 1 ? "s" : ""} à « qui est là »</span>}
                    <button
                      type="button"
                      className="santa-btn-ghost min-h-10 self-start px-3 text-sm"
                      disabled={busy || view.archived}
                      onClick={() => (h.outOfRange ? widen(h.day) : onToggleMeal(h.id))}
                    >
                      {h.outOfRange ? "Ajouter ce jour aux dates" : "Remettre ce repas"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {m.enabled && (
            <Link href={`/santa/${view.code}/repas`} className="santa-btn-ghost flex min-h-11 items-center justify-center px-4 text-sm">
              🍽️ Ouvrir les repas
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Who gets into this page. It's closed from the start: the password lets someone in, it doesn't keep anyone out. */
function Access({ view, busy, onPassword }: { view: OrgView; busy: boolean; onPassword: (password: string | null) => Promise<boolean> }) {
  const [password, setPassword] = useState("");
  return (
    <div className="border-t border-[var(--s-line)] pt-3">
      <p className="text-sm font-semibold">🔒 Accès à cette page</p>
      <p className="mt-1 text-sm text-[var(--s-muted)]">
        {view.hasCohostPassword
          ? `Mot de passe défini. Un membre qui a le code ${view.code} et ce mot de passe peut co-organiser (Jeux › Secret Santa › Co-organiser un Secret Santa). Personne d'autre n'entre ici.`
          : "Déjà fermée : personne d'autre que toi et tes co-organisateurs ne l'ouvre, pas même un administrateur du club. Un mot de passe sert seulement à laisser entrer quelqu'un sans l'ajouter toi-même."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={100}
          autoComplete="off"
          aria-label="Nouveau mot de passe de co-organisation"
          placeholder={view.hasCohostPassword ? "Nouveau mot de passe" : "Mot de passe (4 caractères au moins)"}
          className="santa-field min-h-11 min-w-0 flex-1 px-3"
        />
        <button
          type="button"
          className="santa-btn-ghost min-h-11 px-3 text-sm"
          disabled={busy || password.trim().length < 4}
          onClick={async () => {
            if (await onPassword(password)) setPassword("");
          }}
        >
          {view.hasCohostPassword ? "Changer" : "Définir"}
        </button>
      </div>
      {view.hasCohostPassword && (
        <button type="button" className="mt-2 -mb-2 py-2 text-xs text-[var(--s-muted)] underline" disabled={busy} onClick={() => void onPassword(null)}>
          Retirer le mot de passe
        </button>
      )}
    </div>
  );
}

function Participants({
  view,
  members,
  busy,
  onAddMember,
  onAddGuest,
  onUpdateGuest,
  onRemove,
  onResend,
  onUnmask,
}: {
  view: OrgView;
  members: { id: string; name: string }[];
  busy: boolean;
  onAddMember: (memberId: string) => Promise<boolean>;
  onAddGuest: (name: string, email: string) => Promise<boolean>;
  onUpdateGuest: (id: string, name: string, email: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onResend: (id: string) => Promise<boolean>;
  onUnmask: (p: OrgParticipant) => void;
}) {
  const launched = view.status === "launched";
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const taken = new Set(view.participants.map((p) => p.name));
  const candidates = members.filter((m) => !taken.has(m.name));

  return (
    <section className="santa-panel p-4">
      <p className="santa-label">Participants ({view.participants.length})</p>
      {view.participants.length === 0 && <p className="mt-2 text-sm text-[var(--s-muted)]">Ajoute des membres du club ou des invités par leur adresse mail. Pense à t&apos;ajouter si tu participes !</p>}
      <ul className="mt-2 flex flex-col divide-y divide-[var(--s-line)]">
        {view.participants.map((p) => (
          <ParticipantRow key={p.id} p={p} launched={launched} busy={busy} onUpdate={onUpdateGuest} onRemove={onRemove} onResend={onResend} onUnmask={onUnmask} />
        ))}
      </ul>
      {!launched && (
        <div className="mt-4 flex flex-col gap-4 border-t border-[var(--s-line)] pt-4">
          {candidates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                aria-label="Membre du club à ajouter"
                className="santa-field min-h-11 min-w-0 flex-1 px-3 [color-scheme:dark]"
              >
                <option value="">Un membre du club…</option>
                {candidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="santa-btn-ghost min-h-11 px-3 text-sm"
                disabled={busy || !memberId}
                onClick={async () => {
                  if (await onAddMember(memberId)) setMemberId("");
                }}
              >
                Ajouter
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Prénom d'un invité"
              aria-label="Prénom de l'invité"
              className="santa-field min-h-11 min-w-32 flex-1 px-3"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Son adresse mail"
              aria-label="Adresse mail de l'invité"
              className="santa-field min-h-11 min-w-44 flex-[2] px-3"
            />
            <button
              type="button"
              className="santa-btn-ghost min-h-11 px-3 text-sm"
              disabled={busy || !name.trim() || !email.trim()}
              onClick={async () => {
                if (await onAddGuest(name, email)) {
                  setName("");
                  setEmail("");
                }
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ParticipantRow({
  p,
  launched,
  busy,
  onUpdate,
  onRemove,
  onResend,
  onUnmask,
}: {
  p: OrgParticipant;
  launched: boolean;
  busy: boolean;
  onUpdate: (id: string, name: string, email: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onResend: (id: string) => Promise<boolean>;
  onUnmask: (p: OrgParticipant) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [resend, setResend] = useState<"sending" | "sent" | null>(null);
  const [name, setName] = useState(p.name);
  const [email, setEmail] = useState(p.email ?? "");

  if (editing) {
    return (
      <li className="flex flex-wrap gap-2 py-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Prénom" className="santa-field min-h-10 min-w-28 flex-1 px-3 text-sm" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Adresse mail" className="santa-field min-h-10 min-w-40 flex-[2] px-3 text-sm" />
        <button
          type="button"
          className="santa-btn min-h-10 px-3 text-sm"
          disabled={busy}
          onClick={async () => {
            if (await onUpdate(p.id, name, email)) setEditing(false);
          }}
        >
          Enregistrer
        </button>
        <button type="button" className="santa-btn-ghost min-h-10 px-3 text-sm" onClick={() => setEditing(false)}>
          Annuler
        </button>
      </li>
    );
  }
  const link = "-my-2 py-2 text-xs text-[var(--s-muted)] underline hover:text-[var(--s-ink)]";
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
      <div className="min-w-0">
        <p className="font-semibold">{p.name}</p>
        <p className="truncate text-xs text-[var(--s-muted)]">
          {p.isMember ? "Membre du club" : p.email}
          {launched && (
            <>
              {" · "}
              {p.mailError ? (
                <span className="text-[var(--s-red)]">{p.mailError}</span>
              ) : resend === "sent" ? (
                <span role="status" className="text-[var(--s-green)]">
                  mail renvoyé ✓
                </span>
              ) : p.revealed ? <span className="text-[var(--s-green)]">cadeau ouvert 🎁</span> : p.mailSent ? "mail envoyé" : "mail en attente"}
            </>
          )}
        </p>
      </div>
      <div className="flex gap-3">
        {!p.isMember && (
          <button type="button" className={link} onClick={() => setEditing(true)}>
            Modifier
          </button>
        )}
        {launched ? (
          <>
            <button
              type="button"
              className={link}
              disabled={busy}
              onClick={async () => {
                setResend("sending");
                setResend((await onResend(p.id)) ? "sent" : null);
              }}
            >
              {resend === "sending" ? "Envoi…" : "Renvoyer le mail"}
            </button>
            <button type="button" className={link} onClick={() => onUnmask(p)}>
              Démasquer
            </button>
          </>
        ) : (
          <button type="button" className={link} disabled={busy} onClick={() => onRemove(p.id)} aria-label={`Retirer ${p.name}`}>
            Retirer
          </button>
        )}
      </div>
    </li>
  );
}

function Exclusions({
  view,
  busy,
  onAdd,
  onRemove,
}: {
  view: OrgView;
  busy: boolean;
  onAdd: (fromId: string, toId: string, mutual: boolean) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const launched = view.status === "launched";
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [mutual, setMutual] = useState(true);
  return (
    <section className="santa-panel p-4">
      <p className="santa-label">Règles d&apos;exclusion</p>
      {view.exclusions.length === 0 && <p className="mt-2 text-sm text-[var(--s-muted)]">Pour que deux personnes ne se tirent pas, un couple par exemple.</p>}
      <ul className="mt-2 flex flex-col gap-1.5">
        {view.exclusions.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{r.mutual ? `${r.fromName} et ${r.toName} ne peuvent pas se tirer` : `${r.fromName} ne peut pas tirer ${r.toName}`}</span>
            {!launched && (
              <button type="button" className="-my-2 py-2 text-xs text-[var(--s-muted)] underline" disabled={busy} onClick={() => onRemove(r.id)}>
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>
      {!launched && view.participants.length >= 2 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-[var(--s-line)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <PersonSelect label="Qui" value={fromId} onChange={setFromId} view={view} />
            <span className="text-sm text-[var(--s-muted)]">{mutual ? "et" : "ne peut pas tirer"}</span>
            <PersonSelect label="Avec qui" value={toId} onChange={setToId} view={view} />
            <button
              type="button"
              className="santa-btn-ghost min-h-11 px-3 text-sm"
              disabled={busy || !fromId || !toId}
              onClick={async () => {
                if (await onAdd(fromId, toId, mutual)) {
                  setFromId("");
                  setToId("");
                }
              }}
            >
              Ajouter la règle
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--s-muted)]">
            <input type="checkbox" checked={mutual} onChange={(e) => setMutual(e.target.checked)} className="h-4 w-4 accent-[var(--s-green)]" />
            Dans les deux sens (aucun des deux ne peut tirer l&apos;autre)
          </label>
        </div>
      )}
    </section>
  );
}

function PersonSelect({ label, value, onChange, view }: { label: string; value: string; onChange: (id: string) => void; view: OrgView }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="santa-field min-h-11 min-w-28 flex-1 px-3 [color-scheme:dark]">
      <option value="">Choisir…</option>
      {view.participants.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function Cohosts({
  view,
  members,
  busy,
  onAdd,
  onRemove,
}: {
  view: OrgView;
  members: { id: string; name: string }[];
  busy: boolean;
  onAdd: (memberId: string) => Promise<boolean>;
  onRemove: (memberId: string) => void;
}) {
  const [choice, setChoice] = useState("");
  const candidates = members.filter((m) => !view.cohosts.some((c) => c.memberId === m.id));
  return (
    <details className="santa-panel p-4">
      <summary className="cursor-pointer font-bold">👥 Co-organisateurs{view.cohosts.length > 0 && ` (${view.cohosts.length})`}</summary>
      <p className="mt-2 text-sm text-[var(--s-muted)]">Ils gèrent le Secret Santa avec toi, sauf le supprimer. Eux non plus ne voient pas le tirage.</p>
      {view.cohosts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {view.cohosts.map((c) => (
            <li key={c.memberId} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{c.name}</span>
              <button type="button" className="-my-2 py-2 text-xs text-[var(--s-muted)] underline" disabled={busy} onClick={() => onRemove(c.memberId)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Co-organisateur à ajouter" className="santa-field min-h-11 min-w-0 flex-1 px-3 [color-scheme:dark]">
            <option value="">Choisir un membre du club…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="santa-btn-ghost min-h-11 px-3 text-sm"
            disabled={busy || !choice}
            onClick={async () => {
              if (await onAdd(choice)) setChoice("");
            }}
          >
            Ajouter
          </button>
        </div>
      )}
    </details>
  );
}
