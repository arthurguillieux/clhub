"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SantaDialog } from "@/app/(santa)/santa/SantaDialog";
import { STAGE_LABELS, euros, giftCount, isTaken, joinNames, siteOf } from "@/modules/lettre/domain/letter";
import type { GiftView, OrgView } from "@/modules/lettre/views";
import { de, que } from "@/modules/santa/words";
import { deleteLetterAction, letterNextYearAction, letterOrgAction } from "../../actions";
import { ImagePicker } from "../../ImagePicker";
import { GiftEditor, type GiftPayload } from "./GiftEditor";

type Dialog = Omit<Parameters<typeof SantaDialog>[0], "onClose">;
type Send = (action: Record<string, unknown>, options?: { quiet?: boolean }) => Promise<string | null>;

/** How often an open page asks for the list again: what the family reserves meanwhile shows up. */
const REFRESH_MS = 40_000;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function LetterPanel({
  code,
  initialView,
  isCreator,
  members,
}: {
  code: string;
  initialView: OrgView;
  /** The creator picks co-organizers and can delete the letter; co-organizers do everything else. */
  isCreator: boolean;
  members: { id: string; name: string; isHost: boolean }[];
}) {
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [nextYear, setNextYear] = useState(false);
  /** Moves at the start and the end of every action: a refresh that crossed one is older than what's shown, and dropped. */
  const actions = useRef(0);

  /** Runs an action; answers with its error, or null. `quiet` leaves the error to the caller, shown next to what failed. */
  const send: Send = async (action, options) => {
    actions.current += 1;
    setBusy(true);
    setError("");
    try {
      const result = await letterOrgAction(code, action);
      if (!result.ok) {
        if (!options?.quiet) setError(result.error);
        return result.error;
      }
      setView(result.view);
      return null;
    } catch {
      const message = "Pas de connexion — réessaie.";
      if (!options?.quiet) setError(message);
      return message;
    } finally {
      actions.current += 1;
      setBusy(false);
    }
  };

  // The family reserves while this page is open: it catches up every 40 s, and when it comes back to the screen.
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const before = actions.current;
      try {
        const result = await letterOrgAction(code, { type: "refresh" });
        if (result.ok && actions.current === before) setView(result.view);
      } catch {
        // Offline for a moment: the next round will do.
      }
    };
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code]);

  const pots = view.gifts.filter((g) => g.pot);
  const taken = view.gifts.filter(isTaken).length;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Link href="/jeux/lettre" className="santa-note text-sm text-[var(--s-muted)] hover:text-[var(--s-ink)]">
          ← Ma lettre au Père Noël
        </Link>
        <p className="santa-label mt-3">
          {capitalize(STAGE_LABELS[view.stage])} · code {code}
          {!isCreator && " · co-organisation"}
        </p>
        <h1 className="santa-title mt-1 text-3xl">{view.title}</h1>
        <p className="santa-note mt-2 inline-block text-sm text-[var(--s-muted)]">
          {capitalize(giftCount(view.gifts.length))}
          {taken > 0 && ` · ${taken} déjà pris`}
          {pots.map((p) => ` · 💶 ${p.title} : ${euros(p.totalCents)} sur ${euros(p.priceCents ?? 0)}`).join("")}
        </p>
        {view.previousTitle && view.stage === "preparation" && <p className="santa-note mt-1 text-xs text-[var(--s-muted)]">Dupliquée de « {view.previousTitle} ».</p>}
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-[var(--s-red)] bg-[rgba(180,35,58,0.08)] px-3 py-2.5 text-sm">
          {error}
        </p>
      )}

      <ShareCard
        view={view}
        busy={busy}
        onShare={() =>
          setDialog({
            title: "Envoyer la lettre ?",
            detail:
              "Un seul lien est créé pour toute la famille : tu l'envoies par WhatsApp, SMS ou mail, et chacun peut réserver dès qu'il l'ouvre. Tu pourras toujours changer la lettre et les cadeaux : la liste se met à jour pour tout le monde.",
            confirmLabel: "Créer le lien",
            cancelLabel: "Pas encore",
            onConfirm: () => void send({ type: "share" }),
          })
        }
      />

      <LetterDetails view={view} busy={busy} send={send} />

      <Gifts view={view} code={code} busy={busy} send={send} ask={setDialog} />

      {view.stage !== "preparation" && <AfterChristmas view={view} busy={busy} send={send} ask={setDialog} />}

      <details className="santa-panel p-4">
        <summary className="cursor-pointer font-bold">⚙️ Réglages</summary>
        <div className="mt-3 flex flex-col gap-4">
          {isCreator && <Cohosts view={view} members={members.filter((m) => !m.isHost)} busy={busy} send={send} />}
          {isCreator && <Access view={view} busy={busy} send={send} />}
          <div className="flex flex-col gap-2.5 border-t border-[var(--s-line)] pt-3">
            <button type="button" className="santa-btn-ghost min-h-12 px-4" disabled={busy} onClick={() => setNextYear(true)}>
              📄 Dupliquer pour Noël {view.year + 1}
            </button>
            {isCreator && (
              <button
                type="button"
                className="santa-btn-ghost min-h-12 px-4 text-[var(--s-red)]"
                onClick={() =>
                  setDialog({
                    title: "Supprimer cette lettre ?",
                    detail: "La lettre, ses photos, ses cadeaux et tout ce que la famille a réservé sont effacés définitivement. Le lien envoyé ne marchera plus.",
                    confirmLabel: "Supprimer définitivement",
                    cancelLabel: "Garder la lettre",
                    danger: true,
                    onConfirm: () => void deleteLetterAction(code),
                  })
                }
              >
                Supprimer cette lettre
              </button>
            )}
          </div>
        </div>
      </details>

      {nextYear && <NextYearDialog code={code} year={view.year + 1} untaken={view.gifts.filter((g) => g.offers.length === 0).length} onClose={() => setNextYear(false)} />}
      {dialog && <SantaDialog {...dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ShareCard({ view, busy, onShare }: { view: OrgView; busy: boolean; onShare: () => void }) {
  const [copied, setCopied] = useState(false);
  const path = view.link.replace(/^https?:\/\/[^/]+/, "");
  const ghost = "santa-btn-ghost flex min-h-12 items-center justify-center px-4 text-center";
  const peek = (
    <>
      <Link href={path} className={ghost}>
        👀 {view.stage === "preparation" ? "Aperçu de la page de la famille" : "Voir la page de la famille"}
      </Link>
      <Link href={`${path}?enfant`} className={ghost}>
        🧒 Montrer à {view.childName}
      </Link>
    </>
  );

  if (view.stage === "preparation") {
    return (
      <section className="santa-panel p-4">
        <p className="santa-label">Quand la liste est prête</p>
        <p className="mt-1 text-sm text-[var(--s-muted)]">
          Écris la lettre avec {view.childName}, ajoute ses cadeaux, puis crée le lien à envoyer à la famille. Tu pourras tout changer ensuite.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" className="santa-btn min-h-12 px-4 sm:col-span-2" disabled={busy} onClick={onShare}>
            💌 La lettre est prête : créer le lien
          </button>
          {peek}
        </div>
      </section>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(view.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };
  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: view.title, text: `${view.childName} a écrit sa lettre au Père Noël 🎄 Ouvrez-la ici :`, url: view.link });
    } catch {
      // Closed without sharing: nothing to do.
    }
  };

  return (
    <section className="santa-panel p-4">
      <p className="santa-label">Le lien de la famille</p>
      <p className="mt-1 text-sm text-[var(--s-muted)]">Le même pour tout le monde : chacun donne son prénom quand il réserve.</p>
      <input readOnly value={view.link} onFocus={(e) => e.target.select()} aria-label="Lien de la lettre" className="santa-field mt-3 min-h-11 w-full px-3 text-sm" />
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" className="santa-btn min-h-12 px-4" onClick={() => void share()}>
          📤 Partager le lien
        </button>
        <button type="button" className="santa-btn-ghost min-h-12 px-4" onClick={() => void copy()}>
          {copied ? "Lien copié ✓" : "📋 Copier le lien"}
        </button>
        {peek}
      </div>
    </section>
  );
}

function LetterDetails({ view, busy, send }: { view: OrgView; busy: boolean; send: Send }) {
  const [childName, setChildName] = useState(view.childName);
  const [year, setYear] = useState(String(view.year));
  const [words, setWords] = useState(view.words);
  const [advice, setAdvice] = useState(view.advice);
  const [payNote, setPayNote] = useState(view.payNote);
  const [saved, setSaved] = useState(false);
  const dirty = childName !== view.childName || year !== String(view.year) || words !== view.words || advice !== view.advice || payNote !== view.payNote;
  const field = "santa-field w-full px-3";
  const label = "flex flex-col gap-1 text-sm font-semibold";
  const help = "text-xs font-normal text-[var(--s-muted)]";

  return (
    <details className="santa-panel p-4" open={view.stage === "preparation"}>
      <summary className="cursor-pointer font-bold">💌 La lettre</summary>
      <div className="mt-4 flex flex-col gap-4">
        <div className={label}>
          <span>La photo {de(view.childName)}</span>
          <ImagePicker current={view.photo} label="la photo" busy={busy} onPick={(dataUrl) => send({ type: "photo", which: "child", dataUrl })} onRemove={() => void send({ type: "photo", which: "child", dataUrl: null })} />
        </div>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <label className={label}>
            Prénom
            <input value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={30} className={`${field} min-h-11`} />
          </label>
          <label className={label}>
            Noël
            <input value={year} onChange={(e) => setYear(e.target.value)} type="number" inputMode="numeric" min={2020} max={2100} className={`${field} min-h-11`} />
          </label>
        </div>
        <label className={label}>
          Ce {que(view.childName)} écrit au Père Noël
          <textarea value={words} onChange={(e) => setWords(e.target.value)} rows={7} maxLength={3000} placeholder="Cher Père Noël, cette année j'ai été très sage…" className={`${field} lettre-hand py-2 text-base`} />
          <span className={help}>Écrivez-la ensemble, avec ses mots : elle s&apos;affiche en haut de la page, comme une vraie lettre.</span>
        </label>
        <label className={label}>
          Bon à savoir
          <textarea value={advice} onChange={(e) => setAdvice(e.target.value)} rows={3} maxLength={1000} placeholder="L'occasion est la bienvenue, pas de jouets à piles, il chausse du 28…" className={`${field} py-2`} />
          <span className={help}>Pour toute la famille, juste au-dessus de la liste.</span>
        </label>
        <label className={label}>
          Pour envoyer sa part d&apos;une cagnotte
          <input value={payNote} onChange={(e) => setPayNote(e.target.value)} maxLength={300} placeholder="Par Wero au 06 12 34 56 78" className={`${field} min-h-11`} />
          <span className={help}>Affiché quand on ouvre une cagnotte pour y participer, puis dans le récapitulatif de chacun.</span>
        </label>
        <button
          type="button"
          className="santa-btn min-h-12 px-4"
          disabled={busy || !dirty}
          onClick={async () => {
            const failed = await send({ type: "letter", childName, year, words, advice, payNote });
            setSaved(!failed);
          }}
        >
          {saved && !dirty ? "Lettre enregistrée ✓" : "Enregistrer la lettre"}
        </button>
      </div>
    </details>
  );
}

function Gifts({ view, code, busy, send, ask }: { view: OrgView; code: string; busy: boolean; send: Send; ask: (d: Dialog) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const save = (action: Record<string, unknown>) => send(action, { quiet: true });
  const payload = (p: GiftPayload) => ({ ...p });

  return (
    <section className="santa-panel p-4">
      <p className="santa-label">Les cadeaux</p>
      <p className="mt-1 text-xs text-[var(--s-muted)]">Dans l&apos;ordre de la page de la famille : les préférés d&apos;abord.</p>
      {view.gifts.length === 0 && editing !== "new" && <p className="mt-2 text-sm text-[var(--s-muted)]">Pas encore de cadeau : ajoute le premier !</p>}
      {view.gifts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {view.gifts.map((g) =>
            editing === g.id ? (
              <li key={g.id}>
                <GiftEditor code={code} childName={view.childName} gift={g} busy={busy} onSave={(p) => save({ type: "updateGift", id: g.id, ...payload(p) })} onClose={() => setEditing(null)} />
              </li>
            ) : (
              <GiftRow key={g.id} gift={g} busy={busy} send={send} ask={ask} onEdit={() => setEditing(g.id)} />
            ),
          )}
        </ul>
      )}
      <div className="mt-4">
        {editing === "new" ? (
          <GiftEditor code={code} childName={view.childName} gift={null} busy={busy} onSave={(p) => save({ type: "addGift", ...payload(p) })} onClose={() => setEditing(null)} />
        ) : (
          <button type="button" className="santa-btn min-h-12 w-full px-4" disabled={busy} onClick={() => setEditing("new")}>
            ➕ Ajouter un cadeau
          </button>
        )}
      </div>
    </section>
  );
}

function Gauge({ total, target }: { total: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.floor((total * 100) / target)) : 0;
  return (
    <div>
      <div
        className="lettre-gauge"
        data-full={total >= target}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${euros(total)} sur ${euros(target)}`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 flex justify-between text-sm">
        <b>
          {euros(total)} sur {euros(target)}
        </b>
        <span className="text-[var(--s-muted)]">{total >= target ? "🎉 complète" : `${percent} %`}</span>
      </p>
    </div>
  );
}

function GiftRow({ gift, busy, send, ask, onEdit }: { gift: GiftView; busy: boolean; send: Send; ask: (d: Dialog) => void; onEdit: () => void }) {
  const [noting, setNoting] = useState(false);
  /** « reçu » ticks at once; the server's answer follows. */
  const [ticking, setTicking] = useState<Record<string, boolean>>({});
  const tick = async (offerId: string, received: boolean) => {
    setTicking((t) => ({ ...t, [offerId]: received }));
    await send({ type: "received", id: offerId, received });
    setTicking((t) => {
      const next = { ...t };
      delete next[offerId];
      return next;
    });
  };
  const link = "-my-2 py-2 text-xs text-[var(--s-muted)] underline";
  const free = (offerId: string, who: string, amount: number | null) =>
    ask({
      title: amount !== null ? `Retirer la part ${de(who)} ?` : `Libérer « ${gift.title} » ?`,
      detail:
        amount !== null
          ? `Sa part de ${euros(amount)} ne comptera plus dans la cagnotte.`
          : `${who} ne l'offrira plus : le cadeau redevient libre pour tout le monde.`,
      confirmLabel: amount !== null ? "Retirer la part" : "Libérer le cadeau",
      cancelLabel: "Laisser comme ça",
      danger: true,
      onConfirm: () => void send({ type: "removeOffer", id: offerId }),
    });

  return (
    <li className="lettre-row p-3">
      <div className="flex gap-3">
        <div className="lettre-photo h-16 w-16 shrink-0">
          {gift.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by our own route, already resized
            <img src={gift.photo} alt="" />
          ) : (
            <span aria-hidden="true" className="flex h-full items-center justify-center text-2xl">
              🎁
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words">{gift.title}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {gift.favorite && <span className="lettre-chip lettre-chip-star">⭐ Préféré</span>}
            {gift.pot && <span className="lettre-chip lettre-chip-green">💶 Cagnotte</span>}
            {!gift.pot && gift.copies !== 1 && <span className="lettre-chip">{gift.copies === null ? "Autant qu'on veut" : `Jusqu'à ${gift.copies} personnes`}</span>}
            {gift.secondHand && <span className="lettre-chip">♻️ Occasion OK</span>}
          </div>
          <p className="mt-1 text-sm text-[var(--s-muted)]">
            {gift.priceCents !== null && !gift.pot && <>≈ {euros(gift.priceCents)}</>}
            {gift.priceCents !== null && !gift.pot && gift.url && " · "}
            {gift.url && (
              <a href={gift.url} target="_blank" rel="noopener noreferrer" className="underline">
                {siteOf(gift.url)} ↗
              </a>
            )}
          </p>
          {gift.note && <p className="mt-1 text-sm break-words">{gift.note}</p>}
        </div>
      </div>

      {gift.pot ? (
        <div className="mt-3">
          <Gauge total={gift.totalCents} target={gift.priceCents ?? 0} />
          {gift.offers.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {gift.offers.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-3">
                  <span>
                    <b>{o.name}</b> · {euros(o.amountCents ?? 0)}
                  </span>
                  <span className="flex items-center gap-4">
                    <label className="flex min-h-9 items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={ticking[o.id] ?? o.received}
                        disabled={o.id in ticking}
                        onChange={(e) => void tick(o.id, e.target.checked)}
                        className="h-4 w-4 accent-[var(--s-green)]"
                      />
                      reçu
                    </label>
                    <button type="button" className={link} disabled={busy} onClick={() => free(o.id, o.name, o.amountCents)}>
                      Retirer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : gift.offers.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {gift.offers.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3">
              <span className="text-[var(--s-green)]">
                🎁 Offert par <b>{o.name}</b>
              </span>
              <button type="button" className={link} disabled={busy} onClick={() => free(o.id, o.name, null)}>
                Libérer
              </button>
            </li>
          ))}
          {!gift.full && <li className="text-xs text-[var(--s-muted)]">On peut encore l&apos;offrir.</li>}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--s-muted)]">Personne ne l&apos;offre encore.</p>
      )}

      <div className="mt-2 flex flex-wrap gap-x-5">
        <button type="button" className={link} disabled={busy} onClick={onEdit}>
          Modifier
        </button>
        {!gift.full && !noting && (
          <button type="button" className={link} disabled={busy} onClick={() => setNoting(true)}>
            {gift.pot ? "Noter une part" : "Noter une réservation"}
          </button>
        )}
        <button
          type="button"
          className={`${link} text-[var(--s-red)]`}
          disabled={busy}
          onClick={() =>
            ask({
              title: `Supprimer « ${gift.title} » ?`,
              detail: removalDetail(gift),
              confirmLabel: "Supprimer le cadeau",
              cancelLabel: "Garder le cadeau",
              danger: true,
              onConfirm: () => void send({ type: "removeGift", id: gift.id }),
            })
          }
        >
          Supprimer
        </button>
      </div>
      {noting && <NoteOffer gift={gift} busy={busy} send={send} onClose={() => setNoting(false)} />}
    </li>
  );
}

/** What deleting a gift also deletes, and who should hear it from the organizers: the site tells nobody. */
function removalDetail(gift: GiftView): string {
  const people = [...new Set(gift.offers.map((o) => o.name))];
  if (people.length === 0) return "Le cadeau disparaît de la liste.";
  const several = people.length > 1;
  const who = joinNames(people);
  const tell = `Le CLHUB ne prévient personne : pense à le ${several ? "leur" : "lui"} dire.`;
  return gift.pot
    ? `${who} y particip${several ? "aient" : "ait"} déjà : ${several ? "leurs parts seront effacées" : "sa part sera effacée"} aussi. ${tell}`
    : `${who} l'av${several ? "aient" : "ait"} déjà réservé : ${several ? "leurs réservations seront effacées" : "sa réservation sera effacée"} aussi. ${tell}`;
}

/** Someone said it on the phone, or at the table: an organizer notes it for them. */
function NoteOffer({ gift, busy, send, onClose }: { gift: GiftView; busy: boolean; send: Send; onClose: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--s-line)] pt-3">
      <p className="text-xs text-[var(--s-muted)]">Quelqu&apos;un te l&apos;a dit de vive voix ? Note-le ici : la liste se met à jour pour tout le monde.</p>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Prénom" aria-label="Prénom de la personne" className="santa-field min-h-11 min-w-0 flex-1 px-3" />
        {gift.pot && (
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" maxLength={10} placeholder="Montant €" aria-label="Montant promis" className="santa-field min-h-11 w-28 px-3" />
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--s-red)]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="santa-btn min-h-11 px-4 text-sm"
          disabled={busy || !name.trim() || (gift.pot && !amount.trim())}
          onClick={async () => {
            const failed = await send({ type: "noteOffer", giftId: gift.id, name, amount: gift.pot ? amount : "" }, { quiet: true });
            if (failed) setError(failed);
            else onClose();
          }}
        >
          {gift.pot ? "Noter la part" : "Noter la réservation"}
        </button>
        <button type="button" className="santa-btn-ghost min-h-11 px-4 text-sm" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function AfterChristmas({ view, busy, send, ask }: { view: OrgView; busy: boolean; send: Send; ask: (d: Dialog) => void }) {
  const [text, setText] = useState(view.thanksText);
  const closed = view.stage === "closed";
  return (
    <details className="santa-panel p-4" open={closed || view.thanksPublished}>
      <summary className="cursor-pointer font-bold">🎄 Après Noël</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-[var(--s-muted)]">
          Le merci {de(view.childName)} : une photo et quelques mots, que la famille verra en haut de la lettre en rouvrant le lien.
        </p>
        <ImagePicker current={view.thanksPhoto} label="la photo du merci" busy={busy} onPick={(dataUrl) => send({ type: "photo", which: "thanks", dataUrl })} onRemove={() => void send({ type: "photo", which: "thanks", dataUrl: null })} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={1500}
          aria-label={`Le merci ${de(view.childName)}`}
          placeholder="Merci pour tous ces cadeaux ! La draisienne, je l'adore…"
          className="santa-field lettre-hand w-full px-3 py-2 text-base"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="santa-btn min-h-12 px-4" disabled={busy} onClick={() => void send({ type: "thanks", text, publish: true })}>
            {view.thanksPublished ? (text !== view.thanksText ? "Enregistrer le merci" : "Merci publié ✓") : "💌 Publier le merci"}
          </button>
          {view.thanksPublished ? (
            <button type="button" className="santa-btn-ghost min-h-12 px-4" disabled={busy} onClick={() => void send({ type: "thanks", text, publish: false })}>
              Retirer le merci de la page
            </button>
          ) : (
            <button type="button" className="santa-btn-ghost min-h-12 px-4" disabled={busy || text === view.thanksText} onClick={() => void send({ type: "thanks", text, publish: false })}>
              Enregistrer sans publier
            </button>
          )}
        </div>

        <div className="border-t border-[var(--s-line)] pt-3">
          <p className="text-sm font-semibold">{closed ? "Les réservations sont fermées" : "Les réservations sont ouvertes"}</p>
          <p className="mt-1 text-sm text-[var(--s-muted)]">
            {closed
              ? "La famille voit toujours la lettre et qui offre quoi, mais ne peut plus rien réserver ni retirer."
              : "Une fois Noël passé, ferme-les : la lettre reste lisible, en souvenir."}
          </p>
          <button
            type="button"
            className="santa-btn-ghost mt-2 min-h-12 w-full px-4"
            disabled={busy}
            onClick={() =>
              closed
                ? void send({ type: "close", closed: false })
                : ask({
                    title: "Fermer les réservations ?",
                    detail: "La famille voit toujours la lettre et qui offre quoi, mais ne peut plus rien réserver ni retirer. Tu pourras les rouvrir.",
                    confirmLabel: "Fermer les réservations",
                    cancelLabel: "Laisser ouvert",
                    onConfirm: () => void send({ type: "close", closed: true }),
                  })
            }
          >
            {closed ? "Rouvrir les réservations" : "🔒 Fermer les réservations"}
          </button>
        </div>
      </div>
    </details>
  );
}

function Cohosts({ view, members, busy, send }: { view: OrgView; members: { id: string; name: string }[]; busy: boolean; send: Send }) {
  const [choice, setChoice] = useState("");
  const candidates = members.filter((m) => !view.cohosts.some((c) => c.memberId === m.id));
  return (
    <div>
      <p className="text-sm font-semibold">👥 Co-organisateurs{view.cohosts.length > 0 && ` (${view.cohosts.length})`}</p>
      <p className="mt-1 text-sm text-[var(--s-muted)]">
        Ils font tout avec toi et reçoivent les mêmes notifications. Les co-organisateurs, l&apos;accès à la page et la suppression de la lettre restent entre tes mains.
      </p>
      {view.cohosts.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {view.cohosts.map((c) => (
            <li key={c.memberId} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{c.name}</span>
              <button type="button" className="-my-2 py-2 text-xs text-[var(--s-muted)] underline" disabled={busy} onClick={() => void send({ type: "removeCohost", memberId: c.memberId })}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Co-organisateur à ajouter" className="santa-field min-h-11 min-w-0 flex-1 px-3">
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
              if (!(await send({ type: "addCohost", memberId: choice }))) setChoice("");
            }}
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

function Access({ view, busy, send }: { view: OrgView; busy: boolean; send: Send }) {
  const [password, setPassword] = useState("");
  return (
    <div className="border-t border-[var(--s-line)] pt-3">
      <p className="text-sm font-semibold">🔒 Accès à cette page</p>
      <p className="mt-1 text-sm text-[var(--s-muted)]">
        {view.hasCohostPassword
          ? `Mot de passe défini. Un membre qui a le code ${view.code} et ce mot de passe peut co-organiser (Jeux › Ma lettre au Père Noël › Co-organiser une lettre). Personne d'autre n'entre ici.`
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
            if (!(await send({ type: "cohostPassword", password }))) setPassword("");
          }}
        >
          {view.hasCohostPassword ? "Changer" : "Définir"}
        </button>
      </div>
      {view.hasCohostPassword && (
        <button type="button" className="mt-2 -mb-2 py-2 text-xs text-[var(--s-muted)] underline" disabled={busy} onClick={() => void send({ type: "cohostPassword", password: null })}>
          Retirer le mot de passe
        </button>
      )}
    </div>
  );
}

/** Next year's letter, with the gifts nobody gave if wanted. */
function NextYearDialog({ code, year, untaken, onClose }: { code: string; year: number; untaken: number; onClose: () => void }) {
  const [carry, setCarry] = useState(untaken > 0);
  const [going, setGoing] = useState(false);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Dupliquer pour Noël ${year}`} className="santa-veil fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onClick={onClose}>
      <div className="santa-panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <p className="font-display text-xl font-extrabold">Dupliquer pour Noël {year} ?</p>
        <p className="mt-2 text-sm text-[var(--s-muted)]">
          Une nouvelle lettre est créée, en préparation, avec la même photo, le même « Bon à savoir », le mot pour la cagnotte et les mêmes co-organisateurs. La
          lettre de l&apos;enfant repart d&apos;une page blanche. Celle-ci ne change pas.
        </p>
        {untaken > 0 && (
          <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} className="h-5 w-5 accent-[var(--s-green)]" />
            Reprendre {untaken > 1 ? `les ${untaken} cadeaux que personne n'a offerts` : "le cadeau que personne n'a offert"}
          </label>
        )}
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            className="santa-btn min-h-12 px-4"
            disabled={going}
            onClick={() => {
              setGoing(true);
              // Success leaves for the new letter's page; only a failure comes back here.
              letterNextYearAction(code, carry).catch(() => setGoing(false));
            }}
          >
            {going ? "Création…" : `Créer la lettre de ${year}`}
          </button>
          <button type="button" className="santa-btn-ghost min-h-12 px-4" onClick={onClose} autoFocus>
            Pas maintenant
          </button>
        </div>
      </div>
    </div>
  );
}
