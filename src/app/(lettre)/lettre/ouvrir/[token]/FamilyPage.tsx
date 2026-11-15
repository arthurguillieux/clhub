"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { SantaDialog } from "@/app/(santa)/santa/SantaDialog";
import { euros, frenchSpaces, parseEuros, siteOf } from "@/modules/lettre/domain/letter";
import type { FamilyView, GiftView, OfferView } from "@/modules/lettre/views";
import { de } from "@/modules/santa/words";
import { letterFamilyAction } from "../../actions";
import { Envelope } from "./Envelope";

type Dialog = Omit<Parameters<typeof SantaDialog>[0], "onClose">;
type Toast = { text: string; error?: boolean };

/** How often an open page asks for the list again, so a gift someone just took shows as taken. */
const REFRESH_MS = 40_000;

/** `.santa-arrive` in globals.css. */
const ARRIVING_MS = 800;

const openedKey = (letterId: string) => `lettre-ouverte:${letterId}`;
const names = (list: string[]) => [...new Set(list)].join(", ").replace(/, ([^,]*)$/, " et $1");

/** Whether this browser already opened the letter: undefined while the page comes from the server. */
function useOpenedBefore(letterId: string): boolean | undefined {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    () => {
      try {
        return localStorage.getItem(openedKey(letterId)) === "1";
      } catch {
        return false;
      }
    },
    () => undefined,
  );
}

function remember(letterId: string, opened: boolean) {
  try {
    if (opened) localStorage.setItem(openedKey(letterId), "1");
    else localStorage.removeItem(openedKey(letterId));
  } catch {
    // Private browsing: the envelope will simply come back next time.
  }
}

export function FamilyPage({ token, initialView, childMode }: { token: string; initialView: FamilyView; childMode: boolean }) {
  const [view, setView] = useState(initialView);
  const openedBefore = useOpenedBefore(view.letterId);
  /** What's on screen, once someone chose: the envelope, or the letter. Before that, this browser's habit. */
  const [shown, setShown] = useState<"envelope" | "letter" | null>(childMode ? "envelope" : null);
  const [forChild, setForChild] = useState(childMode);
  const [arriving, setArriving] = useState(false);
  const [offering, setOffering] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const envelope = shown ? shown === "envelope" : openedBefore === undefined ? null : !openedBefore;

  const refresh = useCallback(async () => {
    try {
      const result = await letterFamilyAction(token, { type: "refresh" });
      if (result.ok) setView(result.view);
    } catch {
      // Offline for a moment: the next round will do.
    }
  }, [token]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 9000 : 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  /** Runs what the visitor asked; the list always comes back up to date, even when it was refused. */
  async function act(action: Record<string, unknown>): Promise<string | null> {
    try {
      const result = await letterFamilyAction(token, action);
      if (result.view) setView(result.view);
      return result.ok ? null : result.error;
    } catch {
      return "Pas de connexion — réessayez.";
    }
  }

  const withdraw = (gift: GiftView, offer: OfferView) =>
    setDialog({
      title: gift.pot ? `Retirer votre part de ${euros(offer.amountCents ?? 0)} ?` : `Ne plus offrir « ${gift.title} » ?`,
      detail: gift.pot ? "Elle ne comptera plus dans la cagnotte." : "Il redevient libre pour les autres.",
      confirmLabel: gift.pot ? "Retirer ma part" : "Je ne l'offre plus",
      cancelLabel: gift.pot ? "Je la garde" : "Je l'offre toujours",
      danger: true,
      onConfirm: async () => {
        const failed = await act({ type: "withdraw", id: offer.id });
        setToast(failed ? { text: failed, error: true } : { text: gift.pot ? "Votre part est retirée." : `« ${gift.title} » est de nouveau libre.` });
      },
    });

  if (envelope === null) return null;

  if (envelope) {
    return (
      <Envelope
        childName={view.childName}
        onOpened={() => {
          remember(view.letterId, true);
          setShown("letter");
          setArriving(true);
          setTimeout(() => setArriving(false), ARRIVING_MS);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (forChild) {
    return (
      <div className={`flex flex-col gap-6 ${arriving ? "santa-arrive" : ""}`}>
        <LetterPaper view={view} />
        <h2 className="santa-title lettre-hand santa-note mx-auto text-3xl">Ma liste</h2>
        <ul className="grid grid-cols-2 gap-3">
          {view.gifts.map((g) => (
            <li key={g.id} className="santa-panel flex flex-col items-center p-3 text-center">
              <div className="lettre-photo flex aspect-square w-full items-center justify-center">
                {g.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served by our own route, already resized
                  <img src={g.photo} alt="" />
                ) : (
                  <span aria-hidden="true" className="text-5xl">
                    🎁
                  </span>
                )}
              </div>
              <p className="lettre-hand mt-2 text-lg leading-snug font-bold break-words">
                {g.favorite && "⭐ "}
                {g.title}
              </p>
            </li>
          ))}
        </ul>
        <button type="button" className="santa-btn-ghost santa-ledge mx-auto min-h-11 px-4 text-sm" onClick={() => setForChild(false)}>
          Revenir à la liste complète
        </button>
      </div>
    );
  }

  const open = view.stage === "shared";
  const pots = view.gifts.filter((g) => g.pot);
  const gifts = view.gifts.filter((g) => !g.pot);
  const available = gifts.filter((g) => !g.full || g.offers.some((o) => o.mine));
  const given = gifts.filter((g) => g.full && !g.offers.some((o) => o.mine));
  const mine = view.gifts.filter((g) => g.offers.some((o) => o.mine));
  const offeringGift = view.gifts.find((g) => g.id === offering) ?? null;
  const card = { view, open, onOffer: (g: GiftView) => setOffering(g.id), onWithdraw: withdraw };

  return (
    <div className={`flex flex-col gap-5 ${arriving ? "santa-arrive" : ""}`}>
      {view.preview && (
        <p className="santa-panel p-3 text-center text-sm text-[var(--s-gold)]">
          Aperçu : la famille verra cette page une fois la lettre envoyée. On ne peut pas encore réserver.
        </p>
      )}
      {view.stage === "closed" && <p className="santa-panel p-3 text-center text-sm">Noël est passé : les réservations sont fermées. La lettre reste ici, en souvenir.</p>}

      {view.thanks && (
        <section className="santa-panel lettre-paper px-5 pt-5 pb-7 sm:px-8">
          <p className="santa-label">Le merci {de(view.childName)}</p>
          {view.thanks.photo && (
            <figure className="lettre-polaroid mx-auto mt-5 mb-4 w-56">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, already resized */}
              <img src={view.thanks.photo} alt={`${view.childName} avec ses cadeaux`} />
              <figcaption>Merci !</figcaption>
            </figure>
          )}
          {view.thanks.text && <p className="lettre-words mt-2">{frenchSpaces(view.thanks.text)}</p>}
        </section>
      )}

      <LetterPaper view={view} />

      <button
        type="button"
        className="santa-btn-ghost santa-ledge mx-auto min-h-11 px-4 text-sm"
        onClick={() => {
          setForChild(true);
          setShown("envelope");
          window.scrollTo({ top: 0 });
        }}
      >
        🧒 Montrer à {view.childName}
      </button>

      {mine.length > 0 && <MyGifts view={view} gifts={mine} />}

      {view.advice && (
        <section className="santa-panel p-4">
          <p className="santa-label">Bon à savoir</p>
          <p className="mt-2 whitespace-pre-wrap">{frenchSpaces(view.advice)}</p>
        </section>
      )}

      <h2 className="santa-title lettre-hand santa-note mx-auto mt-2 text-3xl">Ma liste</h2>
      {pots.map((g) => (
        <PotCard key={g.id} gift={g} {...card} />
      ))}
      {available.map((g) => (
        <GiftCard key={g.id} gift={g} {...card} />
      ))}
      {view.gifts.length === 0 && <p className="santa-note mx-auto text-sm text-[var(--s-muted)]">La liste est encore vide.</p>}
      {given.length > 0 && (
        <>
          <p className="santa-label santa-note mx-auto mt-2">Déjà offerts</p>
          {given.map((g) => (
            <GiftCard key={g.id} gift={g} {...card} />
          ))}
        </>
      )}

      <button
        type="button"
        className="santa-note mx-auto mt-2 py-2 text-sm text-[var(--s-muted)] underline"
        onClick={() => {
          remember(view.letterId, false);
          setShown("envelope");
          window.scrollTo({ top: 0 });
        }}
      >
        💌 Revoir l&apos;ouverture de la lettre
      </button>

      {offeringGift && (
        <OfferSheet
          gift={offeringGift}
          view={view}
          act={act}
          onClose={() => setOffering(null)}
          onDone={(text) => {
            setOffering(null);
            setToast({ text });
          }}
        />
      )}
      {dialog && <SantaDialog {...dialog} onClose={() => setDialog(null)} />}
      {toast && (
        <p
          role={toast.error ? "alert" : "status"}
          className={`fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-2xl border bg-[var(--s-surface)] p-3 text-center text-sm shadow-xl ${toast.error ? "border-[var(--s-red)] text-[var(--s-red)]" : "border-[var(--s-line)]"}`}
        >
          {toast.text}
        </p>
      )}
    </div>
  );
}

/** The child's own words, on lined paper, with their photo taped on. */
function LetterPaper({ view }: { view: FamilyView }) {
  return (
    <article className="santa-panel lettre-paper px-5 pt-6 pb-8 sm:px-8">
      {view.photo && (
        <figure className="lettre-polaroid mx-auto mb-6 w-44 sm:float-right sm:mt-1 sm:mb-3 sm:ml-6 sm:w-40">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, already resized */}
          <img src={view.photo} alt={view.childName} />
          <figcaption>{view.childName}</figcaption>
        </figure>
      )}
      <p className="lettre-words">{frenchSpaces(view.words || "Cher Père Noël,\nvoici ma liste !")}</p>
      <div className="clear-both" />
    </article>
  );
}

function MyGifts({ view, gifts }: { view: FamilyView; gifts: GiftView[] }) {
  const owing = gifts.some((g) => g.pot && g.offers.some((o) => o.mine && !o.received));
  return (
    <section className="santa-panel p-4">
      <p className="santa-label">Ce que vous offrez</p>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {gifts.flatMap((g) =>
          g.offers
            .filter((o) => o.mine)
            .map((o) => (
              <li key={o.id}>
                {g.pot ? "💶" : "🎁"} <b>{g.title}</b>
                {g.pot ? ` : ${euros(o.amountCents ?? 0)} promis, ${o.received ? "bien reçus, merci ✓" : "à envoyer"}` : g.priceCents !== null ? ` · ≈ ${euros(g.priceCents)}` : ""}
                {!g.pot && g.url && (
                  <>
                    {" · "}
                    <a href={g.url} target="_blank" rel="noopener noreferrer" className="underline">
                      exemple sur {siteOf(g.url)} ↗
                    </a>
                  </>
                )}
              </li>
            )),
        )}
      </ul>
      {owing && view.payNote && (
        <p className="mt-3 text-sm">
          Pour envoyer votre part : <b>{view.payNote}</b>
        </p>
      )}
    </section>
  );
}

type CardProps = { gift: GiftView; view: FamilyView; open: boolean; onOffer: (g: GiftView) => void; onWithdraw: (g: GiftView, o: OfferView) => void };

function GiftHead({ gift }: { gift: GiftView }) {
  return (
    <div className="flex gap-4 p-4">
      {gift.photo && (
        <div className="lettre-photo h-24 w-24 shrink-0 sm:h-28 sm:w-28">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, already resized */}
          <img src={gift.photo} alt={gift.title} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-lg leading-snug font-bold break-words">{gift.title}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {gift.favorite && <span className="lettre-chip lettre-chip-star">⭐ Un de ses préférés</span>}
          {gift.pot && <span className="lettre-chip lettre-chip-green">💶 Cagnotte : tout le monde participe</span>}
          {!gift.pot && gift.copies !== 1 && <span className="lettre-chip">{gift.copies === null ? "Plusieurs personnes peuvent l'offrir" : `Jusqu'à ${gift.copies} personnes peuvent l'offrir`}</span>}
          {gift.secondHand && <span className="lettre-chip">♻️ L&apos;occasion, c&apos;est très bien</span>}
        </div>
        {gift.priceCents !== null && !gift.pot && <p className="mt-1.5 text-sm text-[var(--s-muted)]">≈ {euros(gift.priceCents)}</p>}
        {gift.note && <p className="mt-1.5 text-sm break-words">{gift.note}</p>}
        {gift.url && (
          <a href={gift.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block py-1 text-sm text-[var(--s-green)] underline">
            Voir un exemple sur {siteOf(gift.url)} ↗
          </a>
        )}
      </div>
    </div>
  );
}

function GiftCard({ gift, view, open, onOffer, onWithdraw }: CardProps) {
  const mine = gift.offers.filter((o) => o.mine);
  const others = gift.offers.filter((o) => !o.mine).map((o) => o.name);
  return (
    <article className={`santa-panel overflow-hidden ${gift.full && mine.length === 0 ? "opacity-80" : ""}`}>
      <GiftHead gift={gift} />
      <footer className="flex flex-col gap-2 border-t border-[var(--s-line)] px-4 py-3">
        {mine.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--s-green)]">✓ C&apos;est vous qui l&apos;offrez</span>
            {open && (
              <button type="button" className="-my-2 py-2 text-sm text-[var(--s-muted)] underline" onClick={() => onWithdraw(gift, o)}>
                Je ne l&apos;offre plus
              </button>
            )}
          </div>
        ))}
        {others.length > 0 && <p className="text-sm font-semibold text-[var(--s-green)]">🎁 Offert par {names(others)}</p>}
        {!gift.full && view.stage !== "closed" && (
          <button type="button" className="santa-btn min-h-12 px-4" disabled={!open} onClick={() => onOffer(gift)}>
            🎁 {gift.offers.length > 0 ? "Je l'offre aussi" : "Je l'offre"}
          </button>
        )}
      </footer>
    </article>
  );
}

function PotCard({ gift, view, open, onOffer, onWithdraw }: CardProps) {
  const target = gift.priceCents ?? 0;
  const percent = target > 0 ? Math.min(100, Math.floor((gift.totalCents * 100) / target)) : 0;
  const remaining = Math.max(0, target - gift.totalCents);
  const mine = gift.offers.filter((o) => o.mine);
  const people = gift.offers.map((o) => (o.mine ? "vous" : o.name));
  return (
    <article className="santa-panel overflow-hidden">
      <GiftHead gift={gift} />
      <div className="flex flex-col gap-2 border-t border-[var(--s-line)] px-4 py-3">
        <div className="lettre-gauge" data-full={gift.full} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${euros(gift.totalCents)} sur ${euros(target)}`}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <p className="flex justify-between gap-3 text-sm">
          <b>
            {euros(gift.totalCents)} sur {euros(target)}
          </b>
          <span className="text-[var(--s-muted)]">{percent} %</span>
        </p>
        <p className="text-sm">{gift.full ? "🎉 Objectif atteint : merci à tous !" : `Il manque encore ${euros(remaining)}.`}</p>
        {people.length > 0 && <p className="text-sm text-[var(--s-muted)]">Avec la participation {de(names(people))}.</p>}
        {mine.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              Vous avez promis <b>{euros(o.amountCents ?? 0)}</b>
              {o.received ? " : bien reçus, merci ✓" : view.payNote ? `. Pour l'envoyer : ${view.payNote}` : ""}
            </span>
            {open && !o.received && (
              <button type="button" className="-my-2 py-2 text-sm text-[var(--s-muted)] underline" onClick={() => onWithdraw(gift, o)}>
                Retirer ma part
              </button>
            )}
          </div>
        ))}
        {!gift.full && view.stage !== "closed" && (
          <button type="button" className="santa-btn min-h-12 px-4" disabled={!open} onClick={() => onOffer(gift)}>
            💶 Je participe
          </button>
        )}
      </div>
    </article>
  );
}

/** Giving or promising: a first name (and an amount for a cagnotte), nothing to pay here. */
function OfferSheet({
  gift,
  view,
  act,
  onClose,
  onDone,
}: {
  gift: GiftView;
  view: FamilyView;
  act: (action: Record<string, unknown>) => Promise<string | null>;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [name, setName] = useState(view.myName ?? "");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const remaining = Math.max(0, (gift.priceCents ?? 0) - gift.totalCents);
  const cents = parseEuros(amount);
  const suggestions = [1000, 2000, 3000, 5000].filter((c) => c < remaining);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError("");
    setSending(true);
    const failed = await act({ type: "offer", giftId: gift.id, name, amount: gift.pot ? amount : null });
    setSending(false);
    if (failed) return setError(failed);
    const who = name.trim();
    onDone(gift.pot ? `Merci ${who} ! Votre part de ${euros(cents ?? 0)} est notée.` : `Merci ${who} ! « ${gift.title} » est à votre nom. Vous l'achetez où vous voulez.`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={gift.pot ? `Participer à ${gift.title}` : `Offrir ${gift.title}`} className="santa-veil fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onClick={onClose}>
      <form
        className="santa-panel max-h-[90dvh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="font-display text-xl font-extrabold break-words">{gift.pot ? `Participer : ${gift.title}` : `Vous offrez « ${gift.title} »`}</p>
        <label className="mt-4 flex flex-col gap-1 text-sm font-semibold">
          Votre prénom
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" autoFocus className="santa-field min-h-12 px-3 text-base" />
          <span className="text-xs font-normal text-[var(--s-muted)]">
            Les autres verront « {gift.pot ? `avec la participation ${de(name.trim() || "…")}` : `Offert par ${name.trim() || "…"}`} ».
          </span>
        </label>
        {gift.pot && (
          <div className="mt-4 flex flex-col gap-2 text-sm font-semibold">
            <label className="flex flex-col gap-1">
              Votre part
              <span className="flex items-center gap-2">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" maxLength={10} placeholder="20" className="santa-field min-h-12 w-32 px-3 text-base" />
                <span aria-hidden="true">€</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((c) => (
                <button key={c} type="button" className="santa-btn-ghost min-h-10 px-3 text-sm" onClick={() => setAmount(String(c / 100))}>
                  {euros(c)}
                </button>
              ))}
              {remaining > 0 && (
                <button type="button" className="santa-btn-ghost min-h-10 px-3 text-sm" onClick={() => setAmount((remaining / 100).toFixed(2).replace(".", ",").replace(",00", ""))}>
                  Le reste : {euros(remaining)}
                </button>
              )}
            </div>
            <span className="text-xs font-normal text-[var(--s-muted)]">Il manque encore {euros(remaining)}.</span>
          </div>
        )}
        <p className="mt-4 rounded-xl bg-[var(--s-raised)] p-3 text-sm">
          {gift.pot
            ? view.payNote
              ? `Rien à payer ici. Pour envoyer votre part : ${view.payNote}`
              : "Rien à payer ici : la personne qui vous a envoyé la lettre vous dira comment lui envoyer votre part."
            : "Vous l'achetez de votre côté, où vous voulez : le lien n'est qu'un exemple."}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-[var(--s-red)]">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2.5">
          <button type="submit" className="santa-btn min-h-12 px-4" disabled={sending || !name.trim() || (gift.pot && cents === null)}>
            {sending ? "Un instant…" : gift.pot ? (cents !== null ? `Je promets ${euros(cents)}` : "Je promets ma part") : "Je l'offre"}
          </button>
          <button type="button" className="santa-btn-ghost min-h-12 px-4" onClick={onClose}>
            Je regarde encore
          </button>
        </div>
      </form>
    </div>
  );
}
