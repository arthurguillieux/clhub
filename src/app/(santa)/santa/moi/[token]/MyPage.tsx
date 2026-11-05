"use client";

import { useState } from "react";
import type { MeView, QuestionView } from "@/modules/santa/views";
import { de } from "@/modules/santa/words";
import { santaMeAction } from "../../actions";

const longDate = (date: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T00:00:00Z`));

/** The big reveal, sized on the longest word: a word can't wrap, so it has to fit the width of a small phone. */
function nameSize(name: string): string {
  const longest = Math.max(...name.split(/[\s-]/).map((word) => word.length));
  return longest > 13 ? "text-3xl" : longest > 9 ? "text-4xl" : "text-5xl";
}

export function MyPage({ token, initialView }: { token: string; initialView: MeView }) {
  const [view, setView] = useState(initialView);
  const [error, setError] = useState("");
  const [justOpened, setJustOpened] = useState(false);
  const closed = view.archived;

  async function send(action: Record<string, unknown>): Promise<boolean> {
    setError("");
    try {
      const result = await santaMeAction(token, action);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setView(result.view);
      return true;
    } catch {
      setError("Pas de connexion — réessaie.");
      return false;
    }
  }

  if (view.status !== "launched") {
    return (
      <div className="santa-panel mt-16 p-6 text-center">
        <p className="santa-label">{view.title}</p>
        <h1 className="santa-title mt-2 text-2xl">Le Père Noël prépare son tirage</h1>
        <p className="mt-3 text-sm text-[var(--s-muted)]">Les derniers détails se règlent. Tu recevras un nouveau mail dès que ce sera prêt, {view.name} !</p>
      </div>
    );
  }

  if (!view.revealed) {
    return (
      <Gift
        view={view}
        error={error}
        onOpen={async () => {
          if (await send({ type: "reveal" })) setJustOpened(true);
        }}
      />
    );
  }

  const recipient = view.recipient;
  return (
    <div className="flex flex-col gap-5">
      <header className="relative mt-6 text-center">
        {justOpened && <span aria-hidden="true" className="santa-burst pointer-events-none absolute top-1/2 left-1/2 -mt-16 -ml-16 h-32 w-32 rounded-full" />}
        <p className="santa-label">{view.title}</p>
        <p className="mt-3 text-[var(--s-muted)]">{view.name}, tu offres ton cadeau à</p>
        <h1 className={`santa-title mt-1 ${nameSize(recipient?.name ?? "")} ${justOpened ? "santa-name" : ""}`} style={{ color: "var(--s-green)" }}>
          {recipient?.name ?? "…"}
        </h1>
        <p className="mt-2 text-sm text-[var(--s-muted)]">Chut. Ça reste entre toi et le Père Noël.</p>
      </header>

      {closed && <p className="santa-panel p-3 text-center text-sm text-[var(--s-gold)]">Ce Secret Santa est terminé : cette page est gardée en souvenir.</p>}

      {(view.budget || view.exchangeDate || view.message) && (
        <section className="santa-panel p-4">
          <p className="santa-label">Le mot de l&apos;organisation</p>
          {view.message && <p className="mt-2 whitespace-pre-wrap">{view.message}</p>}
          <p className="mt-2 text-sm text-[var(--s-gold)]">
            {view.budget && <>Budget : {view.budget}</>}
            {view.budget && view.exchangeDate && " · "}
            {view.exchangeDate && <>Échange le {longDate(view.exchangeDate)}</>}
          </p>
        </section>
      )}

      {recipient && (
        <section className="santa-panel p-4">
          <p className="santa-label">La lettre {de(recipient.name)} au Père Noël</p>
          {recipient.letter ? (
            <p className="mt-2 whitespace-pre-wrap">{recipient.letter}</p>
          ) : (
            <p className="mt-2 text-sm text-[var(--s-muted)]">
              {closed ? `${recipient.name} n'a pas écrit de lettre cette année.` : `${recipient.name} n'a pas encore écrit sa lettre. Tu recevras un mail dès qu'elle arrivera.`}
            </p>
          )}
        </section>
      )}

      {recipient && (
        <AskSection
          name={recipient.name}
          asked={view.asked}
          closed={closed}
          onAsk={(question) => send({ type: "ask", question })}
        />
      )}

      <hr className="border-[var(--s-line)]" />

      <Letter letter={view.letter} closed={closed} onSave={(letter) => send({ type: "letter", letter })} />

      {view.toAnswer.length > 0 && (
        <section className="santa-panel p-4">
          <p className="santa-label">Ton Père Noël secret te demande</p>
          <ul className="mt-2 flex flex-col gap-4">
            {view.toAnswer.map((q) => (
              <Answer key={q.id} q={q} closed={closed} onAnswer={(answer) => send({ type: "answer", id: q.id, answer })} />
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-[var(--s-red)]">
          {error}
        </p>
      )}

      <p className="santa-note mx-auto w-fit text-center text-xs text-[var(--s-muted)]">Une question sur l&apos;organisation ? Demande à {view.organizer}.</p>
    </div>
  );
}

/** The gift to open: a parcel that shakes, loses its lid, and only then asks the server for the name. */
function Gift({ view, error, onOpen }: { view: MeView; error: string; onOpen: () => Promise<void> }) {
  const [opening, setOpening] = useState(false);
  const open = () => {
    if (opening) return;
    setOpening(true);
    setTimeout(() => void onOpen().finally(() => setOpening(false)), 1300);
  };
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <p className="santa-label">{view.title}</p>
      <h1 className="santa-title mt-2 text-3xl">Salut {view.name} !</h1>
      <p className="mt-2 max-w-sm text-[var(--s-muted)]">Une place t&apos;attend sous le sapin. Ouvre ton cadeau pour découvrir à qui tu offres le tien.</p>
      <button type="button" onClick={open} aria-label="Ouvrir mon cadeau" className={`relative mt-8 ${opening ? "santa-gift-opening" : "santa-gift-idle"}`}>
        <svg viewBox="0 0 200 210" className="santa-gift h-52 w-52">
          <ellipse className="santa-gift-mound" cx="100" cy="197" rx="96" ry="11" />
          <rect className="santa-gift-box" x="34" y="92" width="132" height="104" rx="10" strokeWidth="4" />
          <rect className="santa-gift-band" x="90" y="92" width="20" height="104" strokeWidth="3" />
          <g className="santa-lid" style={{ transformOrigin: "100px 80px" }}>
            <rect className="santa-gift-lid" x="24" y="64" width="152" height="30" rx="8" strokeWidth="4" />
            <rect className="santa-gift-band" x="90" y="64" width="20" height="30" strokeWidth="3" />
            <path className="santa-gift-bow" d="M100 62 C70 20 42 40 62 56 C74 64 90 62 100 62 C110 62 126 64 138 56 C158 40 130 20 100 62 Z" strokeWidth="4" strokeLinejoin="round" />
          </g>
        </svg>
        {/* Where the snow settles in the white theme; it goes with the first shake. */}
        {!opening && <span aria-hidden="true" className="santa-ledge absolute inset-x-[12%] top-[30.5%] h-px" />}
      </button>
      <button type="button" onClick={open} disabled={opening} className="santa-btn santa-ledge mt-8 min-h-14 px-8 text-lg">
        {opening ? "Ça s'ouvre…" : "🎁 Ouvrir mon cadeau"}
      </button>
      <p className="santa-note mt-3 text-xs text-[var(--s-muted)]">Assure-toi que personne ne regarde ton écran.</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--s-red)]">
          {error}
        </p>
      )}
    </div>
  );
}

function AskSection({ name, asked, closed, onAsk }: { name: string; asked: QuestionView[]; closed: boolean; onAsk: (question: string) => Promise<boolean> }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  if (closed && asked.length === 0) return null;
  return (
    <section className="santa-panel p-4">
      <p className="santa-label">Une question pour {name} ?</p>
      {!closed && <p className="mt-1 text-sm text-[var(--s-muted)]">Pose-la ici : {name} répondra sans savoir que c&apos;est toi.</p>}
      {asked.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {asked.map((q) => (
            <li key={q.id} className="text-sm">
              <p>
                <b>Toi :</b> {q.question}
              </p>
              <p className={q.answer ? "mt-0.5 text-[var(--s-green)]" : "mt-0.5 text-[var(--s-muted)]"}>{q.answer ? `${name} : ${q.answer}` : "Pas encore de réponse"}</p>
            </li>
          ))}
        </ul>
      )}
      {!closed && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Plutôt thé ou café ?"
            aria-label="Ta question"
            className="santa-field px-3 py-2"
          />
          <button
            type="button"
            className="santa-btn-ghost min-h-11 self-start px-4 text-sm"
            disabled={busy || !question.trim()}
            onClick={async () => {
              setBusy(true);
              if (await onAsk(question)) setQuestion("");
              setBusy(false);
            }}
          >
            {busy ? "Envoi…" : "Envoyer anonymement"}
          </button>
        </div>
      )}
    </section>
  );
}

function Letter({ letter, closed, onSave }: { letter: string; closed: boolean; onSave: (letter: string) => Promise<boolean> }) {
  const [text, setText] = useState(letter);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <section className="santa-panel p-4">
      <p className="santa-label">Ta lettre au Père Noël</p>
      {closed ? (
        <p className="mt-2 whitespace-pre-wrap">{letter || "Pas de lettre cette année."}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--s-muted)]">Tes envies, tes goûts, ce dont tu n&apos;as surtout pas besoin. Seule la personne qui t&apos;a tiré·e la lira.</p>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            maxLength={2000}
            rows={6}
            placeholder={"Cher Père Noël,\n\nCette année, j'ai été plutôt sage…"}
            aria-label="Ta lettre au Père Noël"
            className="santa-field mt-2 block w-full px-3 py-2"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className="santa-btn min-h-11 px-4 text-sm"
              disabled={busy || text.trim() === letter.trim()}
              onClick={async () => {
                setBusy(true);
                setSaved(await onSave(text));
                setBusy(false);
              }}
            >
              {busy ? "Envoi…" : letter ? "Mettre à jour ma lettre" : "Envoyer ma lettre"}
            </button>
            {saved && <span className="text-sm text-[var(--s-green)]">Bien reçue au pôle Nord ✓</span>}
          </div>
        </>
      )}
    </section>
  );
}

function Answer({ q, closed, onAnswer }: { q: QuestionView; closed: boolean; onAnswer: (answer: string) => Promise<boolean> }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <li className="text-sm">
      <p className="font-semibold">{q.question}</p>
      {q.answer ? (
        <p className="mt-0.5 text-[var(--s-green)]">Ta réponse : {q.answer}</p>
      ) : closed ? (
        <p className="mt-0.5 text-[var(--s-muted)]">Restée sans réponse</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={500} aria-label="Ta réponse" className="santa-field min-h-11 min-w-0 flex-1 px-3" />
          <button
            type="button"
            className="santa-btn-ghost min-h-11 px-3"
            disabled={busy || !answer.trim()}
            onClick={async () => {
              setBusy(true);
              await onAnswer(answer);
              setBusy(false);
            }}
          >
            Répondre
          </button>
        </div>
      )}
    </li>
  );
}
