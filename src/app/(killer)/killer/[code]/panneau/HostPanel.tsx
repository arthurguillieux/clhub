"use client";

import Link from "next/link";
import { useState } from "react";
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
  | { type: "reset" };

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

const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

export function HostPanel({ code, initialView, joinUrl }: { code: string; initialView: HostGameView; joinUrl: string }) {
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

  const byId = new Map(view.tributes.map((t) => [t.id, t]));
  const joined = view.tributes.filter((t) => t.joined).length;

  return (
    <Shell>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="killer-label">
            {view.status === "lobby" ? "Préparation" : view.status === "running" ? "Partie en cours" : "Partie terminée"} · code {code}
          </p>
          <h1 className="killer-title mt-1 text-2xl">{view.title}</h1>
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
              detail: `Le cercle est figé et chaque tribut inscrit reçoit sa cible et sa mission. ${
                joined < view.tributes.length ? `${view.tributes.length - joined} tribut(s) ne sont pas encore inscrits : ils pourront rejoindre en cours de route.` : ""
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
              detail: "Le dernier tribut tombé revient en jeu, et son tueur retrouve son ancienne cible.",
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
          onAdd={(name, mission, afterId) => send({ type: "add", name, mission, afterId })}
          onReset={askReset}
          onEnd={() =>
            setDialog({
              title: "Terminer la partie maintenant ?",
              detail: "La TV passe à l'écran de fin avec les statistiques, même s'il reste plusieurs tributs.",
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
            <p className="mt-2 text-lg font-bold">{view.stats?.winner ? `🏆 ${view.stats.winner.name} remporte les jeux` : "Partie arrêtée avant la fin"}</p>
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
                  detail: "La partie reprend avec le dernier tribut tombé de retour en jeu.",
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
          <button
            type="button"
            className="killer-btn-ghost min-h-12 px-4 text-[var(--k-muted)]"
            onClick={() =>
              setDialog({
                title: "Supprimer la partie ?",
                detail: "Les tributs, leurs photos et l'historique sont effacés définitivement.",
                confirmLabel: "Supprimer la partie et les photos",
                cancelLabel: "Garder la partie",
                danger: true,
                onConfirm: () => void deleteKillerGameAction(code),
              })
            }
          >
            Supprimer la partie (photos comprises)
          </button>
        </section>
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
      ? "Il faut au moins deux tributs."
      : missingMission
        ? "Chaque tribut doit avoir une mission."
        : null;

  return (
    <section className="mt-5 flex flex-col gap-4">
      <p className="text-sm text-[var(--k-muted)]">
        L&apos;ordre de la liste, c&apos;est le cercle : chacun a pour cible le suivant, le dernier vise le premier. La mission
        d&apos;un tribut, c&apos;est ce que son chasseur devra lui faire faire — elle passe au tueur à chaque élimination.
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
                    aria-label={`Prénom du tribut ${i + 1}`}
                    className="min-h-11 min-w-0 flex-1 killer-field px-3 font-bold text-[var(--k-ink)]"
                  />
                  <button
                    type="button"
                    aria-label={`Retirer ${row.name || "ce tribut"}`}
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
                  aria-label={`Mission de ${row.name || `tribut ${i + 1}`}`}
                  className="killer-field px-3 py-2 text-sm text-[var(--k-ink)]"
                />
                <div className="flex items-center justify-between gap-2">
                  <StatusChip t={saved} />
                  {saved?.joined && (
                    <button type="button" className="-my-2 py-2 text-xs text-[var(--k-muted)] underline" onClick={() => onRelease(saved)}>
                      Libérer sa place
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" className="killer-btn-ghost min-h-12 px-4" onClick={() => onEdit([...draft, { key: crypto.randomUUID(), id: null, name: "", mission: "" }])}>
        + Ajouter un tribut
      </button>

      {circle.length > 0 && (
        <div className="killer-panel p-3">
          <p className="killer-label">Le cercle</p>
          <p className="mt-1.5 text-sm leading-relaxed">{circle.join(" → ")}</p>
          <button type="button" className="killer-btn-ghost mt-3 min-h-11 w-full px-3 text-sm" disabled={busy || draft.length < 2} onClick={onShuffle}>
            🎲 Tirer le cercle au hasard
          </button>
        </div>
      )}

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
  onAdd,
  onReset,
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
  onAdd: (name: string, mission: string, afterId: string | null) => Promise<HostGameView | null>;
  onReset: () => void;
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
          <span className="killer-title text-3xl">{alive.length}</span> tributs encore en jeu
        </p>
        <button type="button" disabled={busy} className="killer-btn-ghost min-h-11 px-3 text-sm" onClick={onReset}>
          ✎ Modifier la partie
        </button>
      </div>
      <p className="-mt-2 text-xs text-[var(--k-muted)]">
        Une mission se change sans arrêter la partie : « Sa mission, sa place » sous chaque tribut. Pour les prénoms ou le
        cercle, « Modifier la partie » ramène à la préparation.
      </p>

      <div>
        <p className="killer-label">Touche le tribut qui vient de tomber</p>
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
                <TributeDetails t={t} onMission={onMission} onRelease={onRelease} />
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
          <p className="killer-label">Tombés ({fallen.length})</p>
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

      <button type="button" disabled={busy} className="killer-btn-ghost min-h-12 px-4 text-[var(--k-muted)]" onClick={onEnd}>
        Terminer la partie
      </button>
    </section>
  );
}

function TributeDetails({
  t,
  onMission,
  onRelease,
}: {
  t: HostTribute;
  onMission: (t: HostTribute, mission: string) => Promise<HostGameView | null>;
  onRelease: (t: HostTribute) => void;
}) {
  const [mission, setMission] = useState(t.mission);
  return (
    <details className="mt-2">
      <summary className="cursor-pointer py-1.5 text-xs text-[var(--k-muted)]">Sa mission, sa place</summary>
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
        {t.joined && (
          <button type="button" className="killer-btn-ghost min-h-10 px-3 text-sm" onClick={() => onRelease(t)}>
            Libérer sa place
          </button>
        )}
      </div>
    </details>
  );
}
