"use client";

import { useState, useTransition } from "react";
import { Card } from "@/core/ui/components/Card";
import { Button } from "@/core/ui/components/Button";
import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { Input } from "@/core/ui/components/Field";
import { SectionTitle } from "@/core/ui/components/Heading";
import { toast } from "@/core/ui/components/Toaster";
import { euros } from "@/core/money";
import type { BirthdayView } from "@/modules/anniversaire/data";
import {
  addIdeaAction,
  answerAction,
  chooseAction,
  deleteBirthdayAction,
  inviteMoreAction,
  removeIdeaAction,
  repaidAction,
  setPriceAction,
  takeChargeAction,
  voteAction,
} from "../actions";

type Result = { ok: true } | { ok: false; error: string };

const ANSWER_LABEL = { pending: "pas encore répondu", yes: "participe", no: "ne participe pas" } as const;

/** One birthday, top to bottom in the order things happen: am I in, the present, who owes what, the ideas, who's in on it. */
export function BirthdayScreen({ view }: { view: BirthdayView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(call: () => Promise<Result>, success?: string) {
    setError(null);
    start(async () => {
      const r = await call();
      if (!r.ok) setError(r.error);
      else if (success) toast(success);
    });
  }

  const chosen = view.ideas.find((i) => i.id === view.chosenIdeaId) ?? null;
  const iAmBuyer = view.buyer?.id === view.me.id;
  const myShare = view.shares.find((s) => s.memberId === view.me.id);
  const owing = view.shares.filter((s) => s.owesBuyer);

  return (
    <div className="mt-6 flex flex-col gap-8" aria-busy={pending}>
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      {/* Am I in? */}
      <section>
        <SectionTitle>Et toi ?</SectionTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["yes", "Je participe"],
              ["no", "Je ne participe pas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={pending}
              aria-pressed={view.me.answer === value}
              onClick={() => run(() => answerAction(view.id, value))}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${view.me.answer === value ? "border-primary bg-primary text-primary-ink" : "border-line text-ink hover:bg-surface"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {view.me.answer === "pending" && <p className="mt-2 text-sm text-muted">Le prix sera partagé entre ceux qui participent.</p>}
      </section>

      {/* The present. */}
      <section>
        <SectionTitle>Le cadeau</SectionTitle>
        {!chosen ? (
          <Card className="mt-3 p-5">
            <p className="text-sm text-muted">
              Pas encore choisi. Proposez des idées et mettez des pouces ;{" "}
              {view.isCreator ? "c'est toi qui tranches, avec « Retenir cette idée »." : `${view.creatorName} tranchera.`}
            </p>
          </Card>
        ) : (
          <Card className="mt-3 flex flex-col gap-4 border-primary/50 p-5">
            <div>
              <p className="font-display text-xl font-extrabold text-ink">🎁 {chosen.title}</p>
              {chosen.url && (
                <a href={chosen.url} target="_blank" rel="noreferrer" className="mt-1 inline-block py-1 text-sm text-primary underline underline-offset-2">
                  Voir le lien
                </a>
              )}
            </div>

            {view.bought ? (
              <p className="text-sm text-ink">
                Acheté par <strong>{view.buyer?.name}</strong> pour <strong className="tabular-nums">{euros(view.priceCents ?? 0)}</strong>.
              </p>
            ) : !view.buyer ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted">Qui s&apos;occupe de l&apos;acheter ?</p>
                <Button type="button" disabled={pending} onClick={() => run(() => takeChargeAction(view.id, true), "C'est noté : tu t'en charges")}>
                  Je m&apos;en charge
                </Button>
              </div>
            ) : iAmBuyer ? (
              <PriceForm disabled={pending} onSave={(price) => run(() => setPriceAction(view.id, price), "Prix noté : les parts sont calculées")} onGiveUp={() => run(() => takeChargeAction(view.id, false))} />
            ) : (
              <p className="text-sm text-ink">
                <strong>{view.buyer.name}</strong> s&apos;en charge.
              </p>
            )}

            {view.isCreator && !view.bought && (
              <button type="button" disabled={pending} onClick={() => run(() => chooseAction(view.id, null))} className="self-start py-1 text-sm text-muted underline underline-offset-2 hover:text-ink">
                Revenir aux idées
              </button>
            )}
            {iAmBuyer && view.bought && (
              <button type="button" disabled={pending} onClick={() => run(() => setPriceAction(view.id, null))} className="self-start py-1 text-sm text-muted underline underline-offset-2 hover:text-ink">
                Corriger le prix
              </button>
            )}
          </Card>
        )}
      </section>

      {/* Who owes what. */}
      {view.bought && view.priceCents && (
        <section>
          <SectionTitle>Les parts</SectionTitle>
          <Card className="mt-3 p-5">
            <p className="text-sm text-muted">
              {view.shares.length > 1 ? (
                <>
                  {euros(view.priceCents)} partagés entre {view.shares.length} participants : {euros(view.shares[0]?.cents ?? 0)} chacun
                  {view.shares.some((s) => s.cents !== view.shares[0]?.cents) ? " (à un centime près)" : ""}.
                </>
              ) : (
                <>Pour l&apos;instant, une seule personne participe : les parts se recalculent dès que d&apos;autres disent « Je participe ».</>
              )}
            </p>
            {myShare && myShare.owesBuyer && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-raised p-4">
                <p className="text-sm text-ink">
                  Ta part : <strong className="tabular-nums">{euros(myShare.cents)}</strong>, à rembourser à <strong>{view.buyer?.name}</strong>.
                </p>
                <button
                  type="button"
                  disabled={pending}
                  aria-pressed={myShare.repaid}
                  onClick={() => run(() => repaidAction(view.id, view.me.id, !myShare.repaid), myShare.repaid ? undefined : "Merci, c'est noté")}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${myShare.repaid ? "border-primary bg-primary text-primary-ink" : "border-line text-ink hover:bg-surface"}`}
                >
                  {myShare.repaid ? "Remboursé ✓" : "J'ai remboursé"}
                </button>
              </div>
            )}
            <ul className="mt-4 divide-y divide-line-soft">
              {view.shares.map((s) => (
                <li key={s.memberId} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink">
                    {s.name}
                    {!s.owesBuyer && <span className="text-muted"> · a payé le cadeau</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-muted">{euros(s.cents)}</span>
                    {s.owesBuyer &&
                      (iAmBuyer ? (
                        <button
                          type="button"
                          disabled={pending}
                          aria-pressed={s.repaid}
                          aria-label={`${s.name} : ${s.repaid ? "remboursé" : "pas encore remboursé"}`}
                          onClick={() => run(() => repaidAction(view.id, s.memberId, !s.repaid))}
                          className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${s.repaid ? "border-primary bg-primary/15 text-ink" : "border-line text-muted hover:text-ink"}`}
                        >
                          {s.repaid ? "Reçu ✓" : "Reçu ?"}
                        </button>
                      ) : (
                        <span className={`text-xs ${s.repaid ? "text-ink" : "text-muted"}`}>{s.repaid ? "remboursé ✓" : "à rembourser"}</span>
                      ))}
                  </span>
                </li>
              ))}
            </ul>
            {owing.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                {owing.filter((s) => s.repaid).length} / {owing.length} remboursés.
              </p>
            )}
          </Card>
        </section>
      )}

      {/* The ideas. */}
      <section>
        <SectionTitle>Les idées</SectionTitle>
        {view.ideas.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aucune idée pour l&apos;instant : lance-toi !</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {view.ideas.map((idea) => (
              <li key={idea.id}>
                <Card className={`flex flex-wrap items-start justify-between gap-3 p-4 ${idea.id === view.chosenIdeaId ? "border-primary/60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {idea.title}
                      {idea.id === view.chosenIdeaId && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-ink">retenue</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {idea.priceCents !== null && <span className="tabular-nums">environ {euros(idea.priceCents)} · </span>}
                      proposée par {idea.authorName}
                    </p>
                    {idea.note && <p className="mt-1 text-sm text-ink">{idea.note}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-4">
                      {idea.url && (
                        <a href={idea.url} target="_blank" rel="noreferrer" className="py-1 text-sm text-primary underline underline-offset-2">
                          Voir le lien
                        </a>
                      )}
                      {view.isCreator && !view.chosenIdeaId && !view.bought && (
                        <button type="button" disabled={pending} onClick={() => run(() => chooseAction(view.id, idea.id), "Idée retenue : les autres sont prévenus")} className="py-1 text-sm font-semibold text-ink underline underline-offset-2 hover:text-primary">
                          Retenir cette idée
                        </button>
                      )}
                      {(idea.mine || view.isCreator) && idea.id !== view.chosenIdeaId && (
                        <ConfirmDeleteButton
                          question={`Retirer l'idée « ${idea.title} » ?`}
                          confirmLabel="Retirer l'idée"
                          keepLabel="Garder l'idée"
                          triggerLabel="Retirer"
                          pendingLabel="Retrait…"
                          quiet
                          onConfirm={() => run(() => removeIdeaAction(view.id, idea.id))}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={idea.votedByMe}
                      aria-label={`${idea.votedByMe ? "Retirer mon pouce de" : "Mettre un pouce à"} « ${idea.title} » (${idea.votes})`}
                      onClick={() => run(() => voteAction(view.id, idea.id))}
                      className={`flex min-h-11 min-w-16 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold tabular-nums ${idea.votedByMe ? "border-primary bg-primary/15 text-ink" : "border-line text-muted hover:text-ink"}`}
                    >
                      <span aria-hidden="true">👍</span>
                      {idea.votes}
                    </button>
                    {idea.voters.length > 0 && <p className="max-w-40 text-right text-xs text-muted">{idea.voters.join(", ")}</p>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {!view.bought && <IdeaForm disabled={pending} onAdd={(idea) => run(() => addIdeaAction(view.id, idea), "Idée ajoutée")} />}
      </section>

      {/* Who's in on it. */}
      <section>
        <SectionTitle>Dans la confidence</SectionTitle>
        <Card className="mt-3 p-5">
          <ul className="flex flex-col gap-2 text-sm">
            {view.participants.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink">
                  {p.name}
                  {p.isCreator && <span className="text-muted"> · organise</span>}
                </span>
                <span className={p.answer === "yes" ? "text-ink" : "text-muted"}>{ANSWER_LABEL[p.answer]}</span>
              </li>
            ))}
          </ul>
          {view.invitable.length > 0 && <InviteMore people={view.invitable} disabled={pending} onInvite={(ids) => run(() => inviteMoreAction(view.id, ids), ids.length > 1 ? "Invitations envoyées" : "Invitation envoyée")} />}
        </Card>
      </section>

      {view.isCreator && (
        <div className="border-t border-line-soft pt-6">
          <ConfirmDeleteButton
            question={`Supprimer l'anniversaire de ${view.name}, ses idées et ses parts ?`}
            confirmLabel="Supprimer l'anniversaire"
            keepLabel="Garder l'anniversaire"
            triggerLabel="Supprimer l'anniversaire"
            onConfirm={() => run(() => deleteBirthdayAction(view.id))}
          />
        </div>
      )}
    </div>
  );
}

function PriceForm({ disabled, onSave, onGiveUp }: { disabled: boolean; onSave: (price: string) => void; onGiveUp: () => void }) {
  const [price, setPrice] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(price);
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-ink">Tu t&apos;en charges. Une fois acheté, note le prix payé : chacun verra sa part.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Prix payé (€)" inputMode="decimal" autoComplete="off" placeholder="49,90" value={price} onChange={(e) => setPrice(e.target.value)} className="max-w-36" />
        <Button type="submit" disabled={disabled || !price.trim()}>
          C&apos;est acheté
        </Button>
      </div>
      <button type="button" disabled={disabled} onClick={onGiveUp} className="self-start py-1 text-sm text-muted underline underline-offset-2 hover:text-ink">
        Je passe la main
      </button>
    </form>
  );
}

function IdeaForm({ disabled, onAdd }: { disabled: boolean; onAdd: (idea: { title: string; url: string; price: string; note: string }) => void }) {
  const empty = { title: "", url: "", price: "", note: "" };
  const [idea, setIdea] = useState(empty);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" className="mt-3" onClick={() => setOpen(true)}>
        ＋ Proposer une idée
      </Button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(idea);
        setIdea(empty);
        setOpen(false);
      }}
      className="mt-3 flex flex-col gap-3 rounded-card border border-line p-4"
    >
      <Input aria-label="L'idée" placeholder="Un coffret de thés, une place de concert…" value={idea.title} onChange={(e) => setIdea({ ...idea, title: e.target.value })} required maxLength={120} autoFocus />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
        <Input aria-label="Lien (facultatif)" placeholder="Lien (facultatif)" type="url" value={idea.url} onChange={(e) => setIdea({ ...idea, url: e.target.value })} />
        <Input aria-label="Prix environ (€, facultatif)" placeholder="Prix environ" inputMode="decimal" value={idea.price} onChange={(e) => setIdea({ ...idea, price: e.target.value })} />
      </div>
      <Input aria-label="Un mot (facultatif)" placeholder="Un mot (facultatif) : la taille, la couleur…" value={idea.note} onChange={(e) => setIdea({ ...idea, note: e.target.value })} maxLength={300} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={disabled || !idea.title.trim()}>
          Ajouter l&apos;idée
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </form>
  );
}

function InviteMore({ people, disabled, onInvite }: { people: { id: string; name: string }[]; disabled: boolean; onInvite: (ids: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <details className="group mt-4 border-t border-line-soft pt-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        ＋ Mettre quelqu&apos;un d&apos;autre dans la confidence
      </summary>
      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {people.map((m) => (
          <li key={m.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="checkbox" checked={picked.includes(m.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))} className="h-5 w-5 accent-primary" />
              {m.name}
            </label>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        className="mt-3"
        disabled={disabled || picked.length === 0}
        onClick={() => {
          onInvite(picked);
          setPicked([]);
        }}
      >
        Inviter
      </Button>
    </details>
  );
}
