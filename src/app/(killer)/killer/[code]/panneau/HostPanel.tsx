"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isMissionIdea, pickMissionIdea } from "@/modules/killer/missionIdeas";
import type { HostGameView, HostTribute } from "@/modules/killer/views";
import { deleteKillerGameAction, killerHostAction } from "../../actions";
import { KillerDialog } from "../../KillerDialog";
import { TributePhoto } from "../../TributePhoto";
import { useLongPoll } from "../../useLongPoll";

type HostAction =
  | { type: "saveLobby"; rows: { id: string | null; name: string; mission: string }[] }
  | { type: "shuffle" }
  | { type: "start" }
  | { type: "eliminate"; playerId: string }
  | { type: "undo" }
  | { type: "add"; name: string; mission: string; afterId: string | null }
  | { type: "release"; playerId: string }
  | { type: "mission"; playerId: string; mission: string }
  | { type: "end" }
  | { type: "reset" }
  | { type: "removePhoto"; playerId: string }
  | { type: "rename"; title: string }
  | { type: "addCohost"; memberId: string }
  | { type: "removeCohost"; memberId: string };

interface DraftRow {
  key: string;
  id: string | null;
  name: string;
  mission: string;
}

type Dialog = {
  title: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

const toDraft = (view: HostGameView): DraftRow[] =>
  view.tributes.map((t) => ({ key: t.id, id: t.id, name: t.name, mission: t.mission }));

const sameRows = (a: DraftRow[], b: DraftRow[]) =>
  JSON.stringify(a.map(({ id, name, mission }) => [id, name, mission])) === JSON.stringify(b.map(({ id, name, mission }) => [id, name, mission]));

/** The unsaved lobby draft, kept in this browser so a reload, a closed tab or a sleeping phone doesn't lose it. */
function readDraft(key: string): DraftRow[] | null {
  try {
    const rows = JSON.parse(window.localStorage.getItem(key) ?? "null") as unknown;
    if (!Array.isArray(rows)) return null;
    const valid = rows.every(
      (r) => r && typeof r.key === "string" && (r.id === null || typeof r.id === "string") && typeof r.name === "string" && typeof r.mission === "string",
    );
    return valid ? (rows as DraftRow[]) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, rows: DraftRow[] | null) {
  try {
    if (rows) window.localStorage.setItem(key, JSON.stringify(rows));
    else window.localStorage.removeItem(key);
  } catch {
    // Private mode: the warning before leaving still protects the draft.
  }
}

const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

export function HostPanel({
  code,
  initialView,
  joinUrl,
  isCreator,
  members,
}: {
  code: string;
  initialView: HostGameView;
  joinUrl: string;
  /** The creator manages co-organizers and can delete the game; a co-organizer can do everything else. */
  isCreator: boolean;
  members: { id: string; name: string }[];
}) {
  const polled = useLongPoll<HostGameView>(`/api/killer/${code}/host`, initialView);
  const [fromAction, setFromAction] = useState<HostGameView | null>(null);
  const view = fromAction && (!polled.data || fromAction.version > polled.data.version) ? fromAction : (polled.data ?? initialView);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);

  // Lobby draft: the organizer's unsaved edits survive incoming updates (a guest joining), clean drafts follow the server.
  const [draft, setDraft] = useState<DraftRow[]>(() => toDraft(initialView));
  const [dirty, setDirty] = useState(false);
  const [syncedVersion, setSyncedVersion] = useState(initialView.version);
  if (!dirty && view.version !== syncedVersion) {
    setSyncedVersion(view.version);
    setDraft(toDraft(view));
  }

  // After a reload: bring back the changes that hadn't been saved yet, and say so.
  const draftKey = `clhub:killer:${code}:draft`;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (initialView.status !== "lobby") return;
    const kept = readDraft(draftKey);
    if (kept && !sameRows(kept, toDraft(initialView))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists in the browser
      setDraft(kept);
      setDirty(true);
      setRestored(true);
    }
  }, [draftKey, initialView]);
  useEffect(() => {
    writeDraft(draftKey, dirty && view.status === "lobby" ? draft : null);
  }, [draftKey, dirty, draft, view.status]);
  // And ask before leaving the page with changes still unsaved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const discardDraft = () => {
    setDraft(toDraft(view));
    setSyncedVersion(view.version);
    setDirty(false);
    setRestored(false);
  };

  async function send(action: HostAction): Promise<HostGameView | null> {
    setBusy(true);
    setError("");
    try {
      const result = await killerHostAction(code, action);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setFromAction(result.view);
      return result.view;
    } catch {
      setError("Pas de connexion — réessaie.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(): Promise<boolean> {
    if (draft.some((r) => !r.name.trim())) {
      setError("Un prénom est vide.");
      return false;
    }
    const saved = await send({ type: "saveLobby", rows: draft.map(({ id, name, mission }) => ({ id, name, mission })) });
    if (!saved) return false;
    setDirty(false);
    setRestored(false);
    setDraft(toDraft(saved));
    setSyncedVersion(saved.version);
    return true;
  }

  const editDraft = (next: DraftRow[]) => {
    setDraft(next);
    setDirty(true);
  };

  if (polled.gone) {
    return (
      <Shell>
        <p className="killer-title mt-20 text-center text-2xl">Partie supprimée</p>
        <Link href="/jeux/killer" className="killer-btn-ghost mx-auto mt-6 px-4 py-3">
          Retour
        </Link>
      </Shell>
    );
  }

  const askReset = () =>
    setDialog({
      title: "Revenir à la préparation ?",
      detail:
        "Pour changer les prénoms, les missions ou le cercle. Les éliminations sont effacées et tout le monde revient en jeu ; les inscriptions et les photos sont gardées. Il faudra relancer la partie.",
      confirmLabel: "Revenir à la préparation",
      cancelLabel: view.status === "running" ? "Laisser la partie en cours" : "Garder la fin",
      onConfirm: () => void send({ type: "reset" }),
    });

  const askDelete = () =>
    setDialog({
      title: "Supprimer la partie ?",
      detail:
        view.status === "running"
          ? "La partie en cours s'arrête : la TV et les téléphones affichent « Partie supprimée ». Les agents, leurs photos et l'historique sont effacés définitivement."
          : "Les agents, leurs photos et l'historique sont effacés définitivement.",
      confirmLabel: "Supprimer la partie et les photos",
      cancelLabel: "Garder la partie",
      danger: true,
      onConfirm: () => void deleteKillerGameAction(code),
    });

  const askRemovePhoto = (t: HostTribute) =>
    setDialog({
      title: `Supprimer la photo de ${t.name} ?`,
      detail: "Son téléphone lui proposera aussitôt d'en prendre une nouvelle. En attendant, la TV affiche un androïde à la visière éteinte.",
      confirmLabel: `Supprimer la photo de ${t.name}`,
      cancelLabel: "Garder la photo",
      danger: true,
      onConfirm: () => void send({ type: "removePhoto", playerId: t.id }),
    });

  const byId = new Map(view.tributes.map((t) => [t.id, t]));
  const joined = view.tributes.filter((t) => t.joined).length;

  return (
    <Shell>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="killer-label">
            {view.status === "lobby" ? "Préparation" : view.status === "running" ? "Partie en cours" : "Partie terminée"} · code {code}
            {!isCreator && " · co-organisation"}
          </p>
          <GameTitle title={view.title} busy={busy} onRename={(title) => send({ type: "rename", title })} />
        </div>
        <Link href={`/killer/${code}/ecran`} target="_blank" className="killer-btn-ghost px-3 py-2.5 text-sm">
          📺 Écran TV
        </Link>
      </header>

      {error && (
        <p role="alert" className="mt-4 killer-alert px-3 py-2.5 text-sm">
          {error}
        </p>
      )}

      {view.status === "lobby" && restored && (
        <div role="status" className="killer-panel mt-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <span>Tes changements non enregistrés ont été retrouvés après le rechargement.</span>
          <button type="button" className="-my-2 py-2 text-xs text-[var(--k-muted)] underline" onClick={discardDraft}>
            Les abandonner
          </button>
        </div>
      )}

      {view.status === "lobby" && (
        <LobbyEditor
          code={code}
          view={view}
          draft={draft}
          dirty={dirty}
          busy={busy}
          joined={joined}
          joinUrl={joinUrl}
          byId={byId}
          onEdit={editDraft}
          onSave={saveDraft}
          onShuffle={async () => {
            if (dirty && !(await saveDraft())) return;
            await send({ type: "shuffle" });
          }}
          onRemovePhoto={askRemovePhoto}
          onDelete={isCreator ? askDelete : undefined}
          onRelease={(t) =>
            setDialog({
              title: `Libérer la place de ${t.name} ?`,
              detail: "Son téléphone sera déconnecté et son prénom redeviendra disponible dans la liste. Sa photo est gardée.",
              confirmLabel: `Libérer la place de ${t.name}`,
              cancelLabel: "Ne rien changer",
              onConfirm: () => void send({ type: "release", playerId: t.id }),
            })
          }
          onStart={() =>
            setDialog({
              title: "Lancer la partie ?",
              detail: `Le cercle est figé et chaque agent inscrit reçoit sa cible et sa mission. ${
                joined < view.tributes.length ? `${view.tributes.length - joined} agent(s) ne sont pas encore inscrits : ils pourront rejoindre en cours de route.` : ""
              }`,
              confirmLabel: "Lancer la partie",
              cancelLabel: "Pas encore",
              onConfirm: () => void send({ type: "start" }),
            })
          }
        />
      )}

      {view.status === "running" && (
        <RunningPanel
          code={code}
          view={view}
          busy={busy}
          byId={byId}
          onEliminate={(victim) => {
            const killer = view.tributes.find((t) => t.alive && t.targetId === victim.id && t.id !== victim.id);
            const inherited = victim.targetId ? byId.get(victim.targetId) : undefined;
            setDialog({
              title: `${victim.name} est éliminé·e ?`,
              detail: killer
                ? `Tué·e par ${killer.name}, qui reçoit sa nouvelle cible${inherited && inherited.id !== killer.id ? ` (${inherited.name})` : ""} et la mission qui va avec.`
                : undefined,
              confirmLabel: `Oui, ${victim.name} est éliminé·e`,
              cancelLabel: `Non, ${victim.name} reste en jeu`,
              danger: true,
              onConfirm: () => void send({ type: "eliminate", playerId: victim.id }),
            });
          }}
          onUndo={() =>
            setDialog({
              title: "Annuler la dernière élimination ?",
              detail: "Le dernier agent éliminé revient en jeu, et son chasseur retrouve son ancienne cible.",
              confirmLabel: "Annuler la dernière élimination",
              cancelLabel: "Garder telle quelle",
              onConfirm: () => void send({ type: "undo" }),
            })
          }
          onRelease={(t) =>
            setDialog({
              title: `Libérer la place de ${t.name} ?`,
              detail: "À faire s'il a changé de téléphone ou de navigateur : il pourra retoucher son prénom et retrouvera sa cible et sa mission.",
              confirmLabel: `Libérer la place de ${t.name}`,
              cancelLabel: "Ne rien changer",
              onConfirm: () => void send({ type: "release", playerId: t.id }),
            })
          }
          onMission={(t, mission) => send({ type: "mission", playerId: t.id, mission })}
          onRemovePhoto={askRemovePhoto}
          onAdd={(name, mission, afterId) => send({ type: "add", name, mission, afterId })}
          onReset={askReset}
          onDelete={isCreator ? askDelete : undefined}
          onEnd={() =>
            setDialog({
              title: "Terminer la partie maintenant ?",
              detail: "La TV passe à l'écran de fin avec les statistiques, même s'il reste plusieurs agents.",
              confirmLabel: "Terminer la partie",
              cancelLabel: "Continuer la partie",
              danger: true,
              onConfirm: () => void send({ type: "end" }),
            })
          }
        />
      )}

      {view.status === "ended" && (
        <section className="mt-6 flex flex-col gap-4">
          <div className="killer-panel p-4">
            <p className="killer-label">Résultat</p>
            <p className="mt-2 text-lg font-bold">{view.stats?.winner ? `🏆 ${view.stats.winner.name} remporte la partie` : "Partie arrêtée avant la fin"}</p>
            <ul className="mt-2 text-sm text-[var(--k-muted)]">
              {view.stats?.podium.map((p, i) => (
                <li key={p.id}>
                  {i + 1}. {p.name} — {p.kills} élimination{p.kills > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
          </div>
          {view.canUndo && (
            <button
              type="button"
              className="killer-btn-ghost min-h-12 px-4"
              onClick={() =>
                setDialog({
                  title: "Annuler la dernière élimination ?",
                  detail: "La partie reprend avec le dernier agent éliminé de retour en jeu.",
                  confirmLabel: "Annuler la dernière élimination",
                  cancelLabel: "Garder la fin",
                  onConfirm: () => void send({ type: "undo" }),
                })
              }
            >
              ↺ Annuler la dernière élimination
            </button>
          )}
          <button type="button" className="killer-btn-ghost min-h-12 px-4" onClick={askReset}>
            ✎ Revenir à la préparation (modifier, rejouer)
          </button>
          {isCreator && <DeleteGameButton onClick={askDelete} />}
        </section>
      )}

      {isCreator && (
        <CohostSetting
          cohosts={view.cohosts}
          members={members}
          busy={busy}
          onAdd={(memberId) => send({ type: "addCohost", memberId })}
          onRemove={(memberId) => send({ type: "removeCohost", memberId })}
        />
      )}

      {dialog && <KillerDialog {...dialog} onClose={() => setDialog(null)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="killer min-h-dvh px-4 pt-5 pb-28">
      <div className="mx-auto flex max-w-xl flex-col">{children}</div>
    </main>
  );
}

/**
 * Co-organizers: club members the creator lets run the game with them — the panel, the TV and the
 * eliminations, from their own account (they still need the Killer password). Creator only.
 */
function CohostSetting({
  cohosts,
  members,
  busy,
  onAdd,
  onRemove,
}: {
  cohosts: HostGameView["cohosts"];
  members: { id: string; name: string }[];
  busy: boolean;
  onAdd: (memberId: string) => Promise<HostGameView | null>;
  onRemove: (memberId: string) => Promise<HostGameView | null>;
}) {
  const [choice, setChoice] = useState("");
  const candidates = members.filter((m) => !cohosts.some((c) => c.memberId === m.id));
  return (
    <details className="killer-panel mt-5 p-3">
      <summary className="cursor-pointer py-1 font-bold">👥 Co-organisateurs{cohosts.length > 0 && ` (${cohosts.length})`}</summary>
      <p className="mt-2 text-sm text-[var(--k-muted)]">
        Avec leur propre compte, ils ouvrent le panneau et l&apos;écran TV et valident les éliminations. Ils ne peuvent pas
        supprimer la partie. Il leur faut aussi le mot de passe du Killer.
      </p>
      {cohosts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {cohosts.map((c) => (
            <li key={c.memberId} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{c.name}</span>
              <button
                type="button"
                className="-my-2 py-2 text-xs text-[var(--k-muted)] underline"
                disabled={busy}
                onClick={() => void onRemove(c.memberId)}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            aria-label="Membre à ajouter comme co-organisateur"
            className="killer-field min-h-11 min-w-0 flex-1 px-3"
          >
            <option value="">Choisir un membre du club…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="killer-btn min-h-11 px-3 text-sm"
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

/** The game's name, with a small « Renommer » that turns it into a field — the TV follows on its next update. */
function GameTitle({ title, busy, onRename }: { title: string; busy: boolean; onRename: (title: string) => Promise<HostGameView | null> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  if (!editing) {
    return (
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="killer-title text-2xl">{title}</h1>
        <button
          type="button"
          className="-my-2 py-2 text-xs text-[var(--k-muted)] underline"
          onClick={() => {
            setValue(title);
            setEditing(true);
          }}
        >
          Renommer
        </button>
      </div>
    );
  }

  const save = async () => {
    if (value.trim() === title) return setEditing(false);
    if (await onRename(value)) setEditing(false);
  };
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={80}
        aria-label="Nom de la partie"
        autoFocus
        className="killer-field min-h-11 min-w-0 flex-1 px-3 font-bold"
      />
      <button type="submit" className="killer-btn min-h-11 px-3 text-sm" disabled={busy || !value.trim()}>
        Enregistrer le nom
      </button>
      <button type="button" className="killer-btn-ghost min-h-11 px-3 text-sm" onClick={() => setEditing(false)}>
        Garder l&apos;ancien
      </button>
    </form>
  );
}

/**
 * "🎲 Une idée du Killer": fills an empty mission with an idea from the bank, or swaps the idea for
 * another. Hidden as soon as the organizer has written their own words, so it never erases them.
 */
function IdeaButton({ value, used, onPick }: { value: string; used: string[]; onPick: (mission: string) => void }) {
  if (value.trim() && !isMissionIdea(value)) return null;
  return (
    <button
      type="button"
      className="-my-1.5 self-start py-1.5 text-xs font-semibold text-[var(--k-accent)]"
      onClick={() => onPick(pickMissionIdea([...used, value]))}
    >
      {value.trim() ? "🎲 Une autre idée" : "🎲 Une idée du Killer"}
    </button>
  );
}

/** The TV's elimination sound: the synthesised cannon, or a file the organizer chose (kept on the NAS, played only by their TV). */
function SoundSetting({ code, soundVersion }: { code: string; soundVersion: number | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/killer/${code}/sound`;

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, { method: "POST", body: file });
      if (!response.ok) setError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "Le son n'est pas passé — réessaie.");
    } catch {
      setError("Pas de connexion — réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError("");
    try {
      await fetch(url, { method: "DELETE" });
    } catch {
      setError("Pas de connexion — réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="killer-panel p-3">
      <summary className="cursor-pointer py-1 font-bold">🔊 Son d&apos;élimination</summary>
      <p className="mt-2 text-sm text-[var(--k-muted)]">
        {soundVersion !== null
          ? "La TV joue ton fichier à chaque élimination."
          : "La TV joue un coup de canon de synthèse. Tu peux le remplacer par un fichier (mp3, 2 Mo au plus)."}{" "}
        Il reste sur le CLHUB, seule ta TV le lit. Si la TV est déjà ouverte, elle le prend en compte toute seule.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {soundVersion !== null && (
          <button type="button" className="killer-btn-ghost min-h-10 px-3 text-sm" onClick={() => void new Audio(`${url}?v=${soundVersion}`).play()}>
            ▶ Écouter
          </button>
        )}
        <button type="button" className="killer-btn-ghost min-h-10 px-3 text-sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Envoi…" : soundVersion !== null ? "Changer de fichier" : "Choisir un fichier audio"}
        </button>
        {soundVersion !== null && (
          <button type="button" className="killer-btn-ghost min-h-10 px-3 text-sm" disabled={busy} onClick={() => void reset()}>
            Revenir au canon de synthèse
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="audio/*,.mp3"
        className="hidden"
        aria-label="Fichier du son d'élimination"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-[var(--k-alert)]">{error}</p>}
    </details>
  );
}

function DeleteGameButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="killer-btn-ghost min-h-12 px-4 text-[var(--k-alert)]" onClick={onClick}>
      Supprimer la partie (photos comprises)
    </button>
  );
}

function StatusChip({ t }: { t: HostTribute | undefined }) {
  if (!t || !t.joined) return <span className="text-xs text-[var(--k-muted)]">pas encore inscrit</span>;
  return <span className="text-xs text-[var(--k-accent)]">{t.photoVersion !== null ? "inscrit ✓ photo" : "inscrit, sans photo"}</span>;
}

// ───────── Préparation ─────────

function LobbyEditor({
  code,
  view,
  draft,
  dirty,
  busy,
  joined,
  joinUrl,
  byId,
  onEdit,
  onSave,
  onShuffle,
  onRelease,
  onRemovePhoto,
  onDelete,
  onStart,
}: {
  code: string;
  view: HostGameView;
  draft: DraftRow[];
  dirty: boolean;
  busy: boolean;
  joined: number;
  joinUrl: string;
  byId: Map<string, HostTribute>;
  onEdit: (rows: DraftRow[]) => void;
  onSave: () => Promise<boolean>;
  onShuffle: () => void;
  onRelease: (t: HostTribute) => void;
  onRemovePhoto: (t: HostTribute) => void;
  onDelete?: () => void;
  onStart: () => void;
}) {
  const move = (i: number, delta: number) => {
    const next = [...draft];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onEdit(next);
  };
  const update = (i: number, patch: Partial<DraftRow>) => onEdit(draft.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const missingMission = draft.some((r) => !r.mission.trim());
  const circle = draft.length >= 2 ? [...draft.map((r) => r.name || "?"), draft[0]!.name || "?"] : [];
  const startBlocker = dirty
    ? "Enregistre d'abord tes changements."
    : draft.length < 2
      ? "Il faut au moins deux agents."
      : missingMission
        ? "Chaque agent doit avoir une mission."
        : null;

  return (
    <section className="mt-5 flex flex-col gap-4">
      <p className="text-sm text-[var(--k-muted)]">
        L&apos;ordre de la liste, c&apos;est le cercle : chacun a pour cible le suivant, le dernier vise le premier. La mission
        d&apos;un agent, c&apos;est ce que son chasseur devra lui faire faire — elle passe au tueur à chaque élimination.
      </p>
      <p className="text-sm">
        <span className="font-bold text-[var(--k-accent)]">
          {joined} / {view.tributes.length}
        </span>{" "}
        inscrits · lien des joueurs : <span className="break-all text-[var(--k-muted)]">{joinUrl}</span>
      </p>

      <ol className="flex flex-col gap-3">
        {draft.map((row, i) => {
          const saved = row.id ? byId.get(row.id) : undefined;
          return (
            <li key={row.key} className="killer-panel flex gap-3 p-3">
              <div className="flex flex-col items-center gap-1">
                {saved ? (
                  <TributePhoto code={code} id={saved.id} name={row.name || "?"} photoVersion={saved.photoVersion} className="w-12" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[var(--k-line)] text-sm text-[var(--k-muted)]">
                    {i + 1}
                  </span>
                )}
                <button type="button" aria-label="Monter" className="killer-btn-ghost h-9 w-9" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label="Descendre" className="killer-btn-ghost h-9 w-9" disabled={i === draft.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    placeholder="Prénom"
                    maxLength={30}
                    aria-label={`Prénom de l'agent ${i + 1}`}
                    className="min-h-11 min-w-0 flex-1 killer-field px-3 font-bold text-[var(--k-ink)]"
                  />
                  <button
                    type="button"
                    aria-label={`Retirer ${row.name || "cet agent"}`}
                    className="killer-btn-ghost h-11 w-11 text-[var(--k-muted)]"
                    onClick={() => onEdit(draft.filter((_, k) => k !== i))}
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={row.mission}
                  onChange={(e) => update(i, { mission: e.target.value })}
                  placeholder="Sa mission : ce qu'on devra lui faire faire…"
                  rows={2}
                  maxLength={600}
                  aria-label={`Mission de ${row.name || `l'agent ${i + 1}`}`}
                  className="killer-field px-3 py-2 text-sm text-[var(--k-ink)]"
                />
                <IdeaButton value={row.mission} used={draft.map((r) => r.mission)} onPick={(mission) => update(i, { mission })} />
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <StatusChip t={saved} />
                  <div className="flex gap-3">
                    {saved && saved.photoVersion !== null && (
                      <button type="button" className="-my-2 py-2 text-xs text-[var(--k-muted)] underline" onClick={() => onRemovePhoto(saved)}>
                        Supprimer la photo
                      </button>
                    )}
                    {saved?.joined && (
                      <button type="button" className="-my-2 py-2 text-xs text-[var(--k-muted)] underline" onClick={() => onRelease(saved)}>
                        Libérer sa place
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" className="killer-btn-ghost min-h-12 px-4" onClick={() => onEdit([...draft, { key: crypto.randomUUID(), id: null, name: "", mission: "" }])}>
        + Ajouter un agent
      </button>
      {draft.some((r) => !r.mission.trim()) && (
        <button
          type="button"
          className="killer-btn-ghost min-h-12 px-4"
          onClick={() => {
            const used = draft.map((r) => r.mission);
            onEdit(
              draft.map((r) => {
                if (r.mission.trim()) return r;
                const mission = pickMissionIdea(used);
                used.push(mission);
                return { ...r, mission };
              }),
            );
          }}
        >
          🎲 Une idée du Killer pour chaque mission vide
        </button>
      )}

      {circle.length > 0 && (
        <div className="killer-panel p-3">
          <p className="killer-label">Le cercle</p>
          <p className="mt-1.5 text-sm leading-relaxed">{circle.join(" → ")}</p>
          <button type="button" className="killer-btn-ghost mt-3 min-h-11 w-full px-3 text-sm" disabled={busy || draft.length < 2} onClick={onShuffle}>
            🎲 Tirer le cercle au hasard
          </button>
        </div>
      )}

      <SoundSetting code={code} soundVersion={view.soundVersion} />
      {onDelete && <DeleteGameButton onClick={onDelete} />}

      <div className="fixed inset-x-0 bottom-0 z-40 killer-bar px-4 py-3">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {dirty ? (
            <button type="button" className="killer-btn min-h-12 px-4" disabled={busy} onClick={() => void onSave()}>
              {busy ? "Enregistrement…" : "Enregistrer les changements"}
            </button>
          ) : (
            <button type="button" className="killer-btn min-h-12 px-4" disabled={busy || !!startBlocker} onClick={onStart}>
              Lancer la partie
            </button>
          )}
          {dirty && <p className="text-center text-xs text-[var(--k-muted)]">Tes changements (ordre, prénoms, missions) ne sont pas encore enregistrés.</p>}
          {!dirty && startBlocker && <p className="text-center text-xs text-[var(--k-muted)]">{startBlocker}</p>}
        </div>
      </div>
    </section>
  );
}

// ───────── Partie en cours ─────────

function RunningPanel({
  code,
  view,
  busy,
  byId,
  onEliminate,
  onUndo,
  onRelease,
  onMission,
  onRemovePhoto,
  onAdd,
  onReset,
  onDelete,
  onEnd,
}: {
  code: string;
  view: HostGameView;
  busy: boolean;
  byId: Map<string, HostTribute>;
  onEliminate: (t: HostTribute) => void;
  onUndo: () => void;
  onRelease: (t: HostTribute) => void;
  onMission: (t: HostTribute, mission: string) => Promise<HostGameView | null>;
  onRemovePhoto: (t: HostTribute) => void;
  onAdd: (name: string, mission: string, afterId: string | null) => Promise<HostGameView | null>;
  onReset: () => void;
  onDelete?: () => void;
  onEnd: () => void;
}) {
  const alive = view.tributes.filter((t) => t.alive);
  const fallen = view.tributes.filter((t) => !t.alive).sort((a, b) => (b.killedAt ?? "").localeCompare(a.killedAt ?? ""));
  const [newName, setNewName] = useState("");
  const [newMission, setNewMission] = useState("");
  const [afterId, setAfterId] = useState("");

  return (
    <section className="mt-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg">
          <span className="killer-title text-3xl">{alive.length}</span> agents encore en jeu
        </p>
        <button type="button" disabled={busy} className="killer-btn-ghost min-h-11 px-3 text-sm" onClick={onReset}>
          ✎ Modifier la partie
        </button>
      </div>
      <p className="-mt-2 text-xs text-[var(--k-muted)]">
        Une mission se change sans arrêter la partie : « Sa mission, sa photo, sa place » sous chaque agent. Pour les prénoms ou le
        cercle, « Modifier la partie » ramène à la préparation.
      </p>

      <div>
        <p className="killer-label">Touche l&apos;agent qui vient d&apos;être éliminé</p>
        <ul className="mt-2 flex flex-col gap-2.5">
          {alive.map((t) => {
            const target = t.targetId ? byId.get(t.targetId) : undefined;
            return (
              <li key={t.id} className="killer-panel p-3">
                <div className="flex items-center gap-3">
                  <TributePhoto code={code} id={t.id} name={t.name} photoVersion={t.photoVersion} className="w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{t.name}</p>
                    <p className="truncate text-xs text-[var(--k-muted)]">
                      chasse {target?.name ?? "?"} {!t.joined && "· pas encore inscrit"}
                    </p>
                  </div>
                  <button type="button" disabled={busy} className="killer-btn-blood min-h-11 shrink-0 px-3 text-sm" onClick={() => onEliminate(t)}>
                    Éliminé·e
                  </button>
                </div>
                <TributeDetails t={t} onMission={onMission} onRelease={onRelease} onRemovePhoto={onRemovePhoto} />
              </li>
            );
          })}
        </ul>
      </div>

      {view.canUndo && (
        <button type="button" disabled={busy} className="killer-btn-ghost min-h-12 px-4" onClick={onUndo}>
          ↺ Annuler la dernière élimination
        </button>
      )}

      {fallen.length > 0 && (
        <div>
          <p className="killer-label">Éliminés ({fallen.length})</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {fallen.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 text-[var(--k-muted)]">
                <TributePhoto code={code} id={t.id} name={t.name} photoVersion={t.photoVersion} fallen className="w-8" />
                <span>
                  <span className="text-[var(--k-ink)]">{t.name}</span>
                  {t.killedAt && ` · ${clock.format(new Date(t.killedAt))}`}
                  {t.killedById && ` · par ${byId.get(t.killedById)?.name ?? "?"}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="killer-panel p-3">
        <summary className="cursor-pointer py-1 font-bold">+ Ajouter un retardataire</summary>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Prénom"
            maxLength={30}
            className="min-h-11 killer-field px-3 text-[var(--k-ink)]"
          />
          <textarea
            value={newMission}
            onChange={(e) => setNewMission(e.target.value)}
            placeholder="Sa mission"
            rows={2}
            maxLength={600}
            className="killer-field px-3 py-2 text-sm text-[var(--k-ink)]"
          />
          <IdeaButton value={newMission} used={view.tributes.map((t) => t.mission)} onPick={setNewMission} />
          <label className="text-sm text-[var(--k-muted)]">
            Qui le chassera ?
            <select
              value={afterId}
              onChange={(e) => setAfterId(e.target.value)}
              className="mt-1 block min-h-11 w-full killer-field px-3 text-[var(--k-ink)]"
            >
              <option value="">Au hasard</option>
              {alive.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="killer-btn min-h-12 px-4"
            disabled={busy || !newName.trim() || !newMission.trim()}
            onClick={async () => {
              if (await onAdd(newName, newMission, afterId || null)) {
                setNewName("");
                setNewMission("");
                setAfterId("");
              }
            }}
          >
            Ajouter au cercle
          </button>
        </div>
      </details>

      <SoundSetting code={code} soundVersion={view.soundVersion} />

      <button type="button" disabled={busy} className="killer-btn-ghost min-h-12 px-4 text-[var(--k-muted)]" onClick={onEnd}>
        Terminer la partie
      </button>
      {onDelete && <DeleteGameButton onClick={onDelete} />}
    </section>
  );
}

function TributeDetails({
  t,
  onMission,
  onRelease,
  onRemovePhoto,
}: {
  t: HostTribute;
  onMission: (t: HostTribute, mission: string) => Promise<HostGameView | null>;
  onRelease: (t: HostTribute) => void;
  onRemovePhoto: (t: HostTribute) => void;
}) {
  const [mission, setMission] = useState(t.mission);
  return (
    <details className="mt-2">
      <summary className="cursor-pointer py-1.5 text-xs text-[var(--k-muted)]">Sa mission, sa photo, sa place</summary>
      <textarea
        value={mission}
        onChange={(e) => setMission(e.target.value)}
        rows={3}
        maxLength={600}
        className="mt-1 w-full killer-field px-3 py-2 text-sm text-[var(--k-ink)]"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="killer-btn-ghost min-h-10 px-3 text-sm" disabled={mission.trim() === t.mission} onClick={() => void onMission(t, mission)}>
          Enregistrer la mission
        </button>
        {t.photoVersion !== null && (
          <button type="button" className="killer-btn-ghost min-h-10 px-3 text-sm" onClick={() => onRemovePhoto(t)}>
            Supprimer la photo
          </button>
        )}
        {t.joined && (
          <button type="button" className="killer-btn-ghost min-h-10 px-3 text-sm" onClick={() => onRelease(t)}>
            Libérer sa place
          </button>
        )}
      </div>
    </details>
  );
}
