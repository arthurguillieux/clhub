"use client";

import { useState } from "react";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import type { Setup } from "@/modules/loups/scenarios/engine";
import { DEFAULT_TEXTS, importSummary, parseTextFile, resolveTexts, type TextFile } from "@/modules/loups/scenarios/texts";
import type { DayEvent, Fault, PublicScenario } from "@/modules/loups/scenarios/types";
import { deleteEveningAction } from "../../actions";
import { Section, type Send } from "./Console";

/** Before the evening: the players and their rooms, the settings, the events, the faults, the projection. */
export function Prep({
  code,
  def,
  view,
  members,
  qrSvg,
  busy,
  send,
}: {
  code: string;
  def: PublicScenario;
  view: ConsoleView;
  members: { id: string; name: string }[];
  qrSvg: string;
  busy: boolean;
  send: Send;
}) {
  const setup = view.setup;
  const [names, setNames] = useState(setup.players.map((p) => p.name).join("\n"));
  const [savedNames, setSavedNames] = useState(names);
  const save = (next: Partial<Setup>) => send({ type: "setup", setup: { ...setup, ...next } });
  const typed = names
    .split("\n")
    .map((n) => n.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const params = setup.params;
  type Key = "loops" | "contagionNights" | "packMax" | "eventsProposed" | "gaugeSeconds" | "voteDoorSeconds" | "voteDeadSeconds" | "voteChiefSeconds" | "confinementSeconds";
  const inMinutes = (key: Key) => key === "gaugeSeconds" || key === "confinementSeconds";
  const number = (key: Key, label: string, min: number, max: number, unit = "") => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          value={inMinutes(key) ? Math.round((params[key] ?? def.defaults[key] ?? 0) / 60) : (params[key] ?? def.defaults[key] ?? 0)}
          onChange={(e) => {
            const v = Math.max(min, Math.min(max, Number(e.target.value) || min));
            void save({ params: { ...params, [key]: inMinutes(key) ? v * 60 : v } });
          }}
          className="scn-field w-20 text-right"
        />
        {unit}
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      <Section title="JOUEURS ET CHAMBRES" chip={<span className="scn-chip">{setup.players.length}</span>} open>
        <p className="text-xs text-[var(--scn-muted)]">Un prénom par ligne, comme sur les badges. La chambre suit l&apos;ordre : le premier dort en chambre 1.</p>
        <textarea value={names} onChange={(e) => setNames(e.target.value)} rows={10} aria-label="Prénoms des joueurs, un par ligne" className="scn-field py-2" />
        <button
          type="button"
          className="scn-btn scn-btn-primary"
          disabled={busy || names === savedNames}
          onClick={async () => {
            // Ids stay with the names already there; new names take the next free number.
            const used = new Set(setup.players.map((p) => p.id));
            let n = 1;
            const fixed = typed.map((name) => {
              const kept = setup.players.find((x) => x.name === name);
              if (kept) return kept;
              while (used.has(`p${n}`)) n += 1;
              used.add(`p${n}`);
              return { id: `p${n}`, name };
            });
            if (!(await save({ players: fixed }))) setSavedNames(names);
          }}
        >
          Enregistrer les {typed.length} joueurs
        </button>
      </Section>

      <Section title="RÉGLAGES">
        {number("loops", "Nombre de boucles", 1, 5)}
        {number("contagionNights", "Nuits de contagion", 0, 10)}
        {number("packMax", "Taille maximale de la meute", 1, 20)}
        {number("eventsProposed", "Événements proposés aux morts", 1, 5)}
        {number("gaugeSeconds", "Durée de la jauge des générateurs", 1, 20, "min")}
        {number("voteDoorSeconds", "Vote de la porte", 10, 600, "s")}
        {number("voteDeadSeconds", "Moment des morts", 10, 600, "s")}
        {number("voteChiefSeconds", "Élection du chef", 10, 900, "s")}
        {number("confinementSeconds", "Durée du confinement", 1, 30, "min")}
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span>Hall éclairé au début de la boucle 2</span>
          <input type="checkbox" checked={params.hallLitLoop2} onChange={(e) => void save({ params: { ...params, hallLitLoop2: e.target.checked } })} className="h-5 w-5" />
        </label>
        <p className="text-sm">Combinaison du circuit (levé ▲ / baissé ▼)</p>
        <div className="grid grid-cols-4 gap-2">
          {params.circuit.map((up, i) => (
            <button
              key={i}
              type="button"
              className={`scn-btn scn-vt text-2xl ${up ? "scn-btn-on" : ""}`}
              disabled={busy}
              onClick={() => {
                const circuit = [...params.circuit] as Setup["params"]["circuit"];
                circuit[i] = !up;
                void save({ params: { ...params, circuit } });
              }}
            >
              {"ABCD"[i]} {up ? "▲" : "▼"}
            </button>
          ))}
        </div>
      </Section>

      <Section title="ÉVÉNEMENTS DU JOUR" chip={<span className="scn-chip">{setup.events.length}</span>}>
        {setup.events.map((e, i) => (
          <EventRow key={e.id} event={e} busy={busy} onSave={(next) => save({ events: setup.events.map((x, j) => (j === i ? next : x)) })} onRemove={() => save({ events: setup.events.filter((_, j) => j !== i) })} />
        ))}
        <button type="button" className="scn-btn" disabled={busy} onClick={() => void save({ events: [...setup.events, { id: `evt-${Date.now()}`, name: "Nouvel événement", rule: "Sa règle en une phrase." }] })}>
          Ajouter un événement
        </button>
        <button type="button" className="py-1 text-xs text-[var(--scn-muted)] underline" disabled={busy} onClick={() => void save({ events: def.events })}>
          Revenir à la liste du scénario
        </button>
      </Section>

      <Texts setup={setup} busy={busy} save={save} />

      <Section title="FICHIERS ET DATES">
        <p className="text-xs text-[var(--scn-muted)]">Ce que les terminaux affichent : nom et date de chaque fichier, le texte des fichiers texte, les sous-titres (une réplique par ligne, avec son temps : « 0:03 Je… ça marche ? »).</p>
        <Dates setup={setup} busy={busy} save={save} />
        {def.terminals.flatMap((t) =>
          t.files.map((f) => <FileRow key={f.id} file={f} terminal={t.label} value={setup.files?.[f.id] ?? {}} busy={busy} onSave={(v) => save({ files: { ...setup.files, [f.id]: v } })} />),
        )}
      </Section>

      <Section title="FAILLES AJOUTÉES" chip={<span className="scn-chip">{def.faults.length} + {setup.extraFaults.length}</span>}>
        <p className="text-xs text-[var(--scn-muted)]">Les failles du scénario sont prêtes. Ajoute les tiennes : un texte, ou une image (un fichier de ton dossier de médias).</p>
        {setup.extraFaults.map((f, i) => (
          <FaultRow key={f.id} fault={f} busy={busy} onSave={(next) => save({ extraFaults: setup.extraFaults.map((x, j) => (j === i ? next : x)) })} onRemove={() => save({ extraFaults: setup.extraFaults.filter((_, j) => j !== i) })} />
        ))}
        <button
          type="button"
          className="scn-btn"
          disabled={busy}
          onClick={() => void save({ extraFaults: [...setup.extraFaults, { id: `faille-${Date.now()}`, title: "Nouvelle faille", loops: [1], kind: "text", text: "", missed: "" }] })}
        >
          Ajouter une faille
        </button>
      </Section>

      <Section title="PROJECTION" chip={<span className={`scn-chip ${view.projection.connected ? "scn-chip-ok" : "scn-chip-bad"}`}>{view.projection.connected ? "connectée" : "pas encore ouverte"}</span>} open>
        <p className="text-xs text-[var(--scn-muted)]">
          Ouvre ce lien sur l&apos;ordinateur branché au vidéoprojecteur. Il y choisira son dossier de médias, autorisera le micro, et passera en plein écran.
        </p>
        <input readOnly value={view.link} onFocus={(e) => e.target.select()} aria-label="Lien de la projection" className="scn-field text-xs" data-projection-link={view.link} />
        <div className="mx-auto w-48 rounded-xl bg-white p-2" aria-label="QR code de la projection" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <details className="text-xs">
          <summary className="cursor-pointer py-2 text-[var(--scn-muted)]">Les fichiers attendus dans le dossier ({def.media.length})</summary>
          <ul className="flex flex-col gap-0.5">
            {def.media.map((m) => (
              <li key={m.id}>
                <code className="text-[var(--scn-amber)]">{m.file}</code> — {m.label}
              </li>
            ))}
          </ul>
        </details>
      </Section>

      {view.role === "host" && <Team view={view} members={members} busy={busy} send={send} />}

      <button type="button" className="scn-btn scn-btn-primary min-h-14 text-base" disabled={busy || setup.players.length < 4} onClick={() => void send({ type: "launch" })}>
        ❄️ Lancer la soirée
        <small>{setup.players.length < 4 ? "il faut au moins 4 joueurs" : "l'écran d'accueil s'affiche sur la projection"}</small>
      </button>
      {view.role === "host" && (
        <button type="button" className="py-2 text-sm text-[var(--scn-bad)] underline" onClick={() => void deleteEveningAction(code)}>
          Supprimer cette soirée
        </button>
      )}
    </div>
  );
}

/**
 * The texts the meneur reads aloud: the scenario's file, or an imported one (after a summary), with
 * hand edits on top. Read-only once the evening is launched.
 */
function Texts({ setup, busy, save }: { setup: Setup; busy: boolean; save: (next: Partial<Setup>) => Promise<string | null> }) {
  const imported = setup.texts?.imported as TextFile | undefined;
  const edited = setup.texts?.edited ?? {};
  const current = resolveTexts(imported, edited);
  const base = (imported ?? DEFAULT_TEXTS).textes;
  const [pending, setPending] = useState<{ file: TextFile; summary: ReturnType<typeof importSummary> } | null>(null);
  const [error, setError] = useState("");
  const [id, setId] = useState("");
  const [draft, setDraft] = useState("");
  const chosen = current.find((t) => t.id === id);
  const original = base.find((t) => t.id === id);
  const edits = Object.keys(edited).length;
  return (
    <Section title="TEXTES À LIRE" chip={<span className="scn-chip">{current.length}</span>}>
      <p className="text-xs text-[var(--scn-muted)]">
        {imported ? `Fichier importé${imported.version ? `, version ${imported.version}` : ""}` : `Fichier du scénario, version ${DEFAULT_TEXTS.version ?? "?"}`} · {current.length} textes
        {edits ? ` · ${edits} retouché${edits > 1 ? "s" : ""} à la main` : ""}. Pendant la soirée, ils sont en lecture seule.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="scn-btn flex cursor-pointer items-center justify-center">
          Importer un fichier
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const parsed = parseTextFile(await f.text());
              if (!parsed.ok) {
                setError(parsed.error);
                return;
              }
              setError("");
              setPending({ file: parsed.file, summary: importSummary(current, parsed.file.textes) });
            }}
          />
        </label>
        <button
          type="button"
          className="scn-btn"
          onClick={() => {
            const file = { ...(imported ?? DEFAULT_TEXTS), textes: current };
            const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "textes_antarctica.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Exporter le fichier
        </button>
      </div>
      {error && <p className="text-xs text-[var(--scn-bad)]">{error}</p>}
      {pending && (
        <div className="rounded-xl border border-[var(--scn-amber)] p-3 text-sm">
          <p>
            Ce fichier remplace les textes actuels : <b>{pending.summary.added.length}</b> ajoutés, <b>{pending.summary.changed.length}</b> modifiés, <b>{pending.summary.removed.length}</b> supprimés.
            {edits ? ` Les ${edits} retouches à la main sont abandonnées.` : ""}
          </p>
          {pending.summary.removed.length > 0 && <p className="mt-1 text-xs text-[var(--scn-muted)]">Supprimés : {pending.summary.removed.join(", ")}</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="scn-btn scn-btn-amber"
              disabled={busy}
              onClick={async () => {
                if (!(await save({ texts: { imported: { version: pending.file.version, textes: pending.file.textes }, edited: {} } }))) setPending(null);
              }}
            >
              Remplacer les textes
            </button>
            <button type="button" className="scn-btn" onClick={() => setPending(null)}>
              Garder les textes actuels
            </button>
          </div>
        </div>
      )}
      <select
        aria-label="Texte à modifier"
        value={id}
        onChange={(e) => {
          setId(e.target.value);
          setDraft(current.find((t) => t.id === e.target.value)?.texte ?? "");
        }}
        className="scn-field"
      >
        <option value="">Modifier un texte…</option>
        {current.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id} · {t.titre}
            {edited[t.id] !== undefined ? " (retouché)" : ""}
          </option>
        ))}
      </select>
      {chosen && (
        <>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={12} aria-label={`Texte ${chosen.id}`} className="scn-field py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="scn-btn scn-btn-primary" disabled={busy || draft === chosen.texte} onClick={() => void save({ texts: { imported, edited: { ...edited, [chosen.id]: draft } } })}>
              {draft === chosen.texte ? "Enregistré ✓" : "Enregistrer"}
            </button>
            <button
              type="button"
              className="scn-btn"
              disabled={busy || edited[chosen.id] === undefined}
              onClick={async () => {
                const rest = { ...edited };
                delete rest[chosen.id];
                if (!(await save({ texts: { imported, edited: rest } }))) setDraft(original?.texte ?? "");
              }}
            >
              Revenir à la version importée
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

function Dates({ setup, busy, save }: { setup: Setup; busy: boolean; save: (next: Partial<Setup>) => Promise<string | null> }) {
  const [world, setWorld] = useState(setup.dates?.world ?? "");
  const [real, setReal] = useState(setup.dates?.real ?? "");
  const dirty = world !== (setup.dates?.world ?? "") || real !== (setup.dates?.real ?? "");
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <label className="flex flex-col gap-1">
        Date de l&apos;en-tête
        <input value={world} onChange={(e) => setWorld(e.target.value)} maxLength={20} placeholder="21.12.1988" className="scn-field" />
      </label>
      <label className="flex flex-col gap-1">
        Date montrée par la faille
        <input value={real} onChange={(e) => setReal(e.target.value)} maxLength={20} placeholder="06.02.2027" className="scn-field" />
      </label>
      <button type="button" className="scn-btn col-span-2" disabled={busy || !dirty} onClick={() => void save({ dates: { world: world.trim() || undefined, real: real.trim() || undefined } })}>
        {dirty ? "Enregistrer les dates" : "Dates enregistrées ✓"}
      </button>
    </div>
  );
}

type FileValue = { name?: string; date?: string; text?: string; subs?: string };

function FileRow({ file, terminal, value, busy, onSave }: { file: PublicScenario["terminals"][number]["files"][number]; terminal: string; value: FileValue; busy: boolean; onSave: (v: FileValue) => Promise<string | null> }) {
  const [v, setV] = useState<FileValue>(value);
  const dirty = JSON.stringify(v) !== JSON.stringify(value);
  const set = (k: keyof FileValue, x: string) => setV({ ...v, [k]: x || undefined });
  return (
    <details className="rounded-lg border border-[var(--scn-line)] p-2 text-sm">
      <summary className="cursor-pointer">
        <span className="scn-vt text-lg text-[var(--scn-amber)]">{v.name || file.name}</span> <span className="text-xs text-[var(--scn-muted)]">· {terminal}</span>
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-2">
          <input value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder={file.name} aria-label="Nom affiché" className="scn-field" />
          <input value={v.date ?? ""} onChange={(e) => set("date", e.target.value)} maxLength={20} placeholder={file.date} aria-label="Date affichée" className="scn-field" />
        </div>
        {file.kind === "text" && (
          <textarea value={v.text ?? ""} onChange={(e) => set("text", e.target.value)} rows={8} maxLength={8000} placeholder="[Rapport du protocole Alpha — à écrire]" aria-label="Texte du fichier" className="scn-field py-2" />
        )}
        {(file.kind === "video" || file.kind === "audio" || file.kind === "recording") && (
          <textarea value={v.subs ?? ""} onChange={(e) => set("subs", e.target.value)} rows={4} maxLength={8000} placeholder={"0:03 Je… ça marche ? Cool !\n0:07 On vient d'arriver avec les autres."} aria-label="Sous-titres" className="scn-field py-2 text-xs" />
        )}
        {file.kind === "registry" && <p className="text-xs text-[var(--scn-muted)]">Construit à partir des joueurs : rien à écrire.</p>}
        <button type="button" className="scn-btn" disabled={busy || !dirty} onClick={() => void onSave(v)}>
          {dirty ? "Enregistrer le fichier" : "Enregistré ✓"}
        </button>
      </div>
    </details>
  );
}

function EventRow({ event, busy, onSave, onRemove }: { event: DayEvent; busy: boolean; onSave: (e: DayEvent) => Promise<string | null>; onRemove: () => void }) {
  const [name, setName] = useState(event.name);
  const [rule, setRule] = useState(event.rule);
  const dirty = name !== event.name || rule !== event.rule;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[var(--scn-line)] p-2">
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Nom de l'événement" className="scn-field scn-vt text-lg" />
      <input value={rule} onChange={(e) => setRule(e.target.value)} maxLength={160} aria-label="Règle de l'événement" className="scn-field text-sm" />
      <div className="flex gap-2">
        <button type="button" className="scn-btn flex-1" disabled={busy || !dirty} onClick={() => void onSave({ ...event, name, rule })}>
          {dirty ? "Enregistrer" : "Enregistré ✓"}
        </button>
        <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={onRemove}>
          Retirer
        </button>
      </div>
    </div>
  );
}

function FaultRow({ fault, busy, onSave, onRemove }: { fault: Fault; busy: boolean; onSave: (f: Fault) => Promise<string | null>; onRemove: () => void }) {
  const [f, setF] = useState(fault);
  const dirty = JSON.stringify(f) !== JSON.stringify(fault);
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[var(--scn-line)] p-2 text-sm">
      <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} aria-label="Titre de la faille" className="scn-field" />
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Boucle" value={f.loops[0] ?? 1} onChange={(e) => setF({ ...f, loops: [Number(e.target.value)] })} className="scn-field">
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              Boucle {n}
            </option>
          ))}
        </select>
        <select aria-label="Type de faille" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Fault["kind"] })} className="scn-field">
          <option value="text">Texte</option>
          <option value="image">Image plein écran</option>
        </select>
      </div>
      {f.kind === "text" ? (
        <textarea value={f.text ?? ""} onChange={(e) => setF({ ...f, text: e.target.value })} rows={2} maxLength={400} aria-label="Texte affiché" placeholder="Le texte qui apparaît à l'écran" className="scn-field py-1" />
      ) : (
        <input value={f.media ?? ""} onChange={(e) => setF({ ...f, media: e.target.value.trim() })} maxLength={60} aria-label="Nom du fichier image" placeholder="nom du fichier, ex. photo-labo.jpg" className="scn-field" />
      )}
      <input value={f.missed} onChange={(e) => setF({ ...f, missed: e.target.value })} maxLength={160} aria-label="Pour la mauvaise fin" placeholder="Pour la mauvaise fin : ce qu'ils ont manqué" className="scn-field" />
      <div className="flex gap-2">
        <button type="button" className="scn-btn flex-1" disabled={busy || !dirty || !f.title.trim()} onClick={() => void onSave({ ...f, missed: f.missed.trim() || f.title })}>
          {dirty ? "Enregistrer" : "Enregistrée ✓"}
        </button>
        <button type="button" className="scn-btn scn-btn-danger" disabled={busy} onClick={onRemove}>
          Retirer
        </button>
      </div>
    </div>
  );
}

function Team({ view, members, busy, send }: { view: ConsoleView; members: { id: string; name: string }[]; busy: boolean; send: Send }) {
  const [choice, setChoice] = useState("");
  const candidates = members.filter((m) => !view.cohosts.some((c) => c.memberId === m.id));
  return (
    <Section title="CO-ORGANISATEURS" chip={<span className="scn-chip">{view.cohosts.length}</span>}>
      <p className="text-xs text-[var(--scn-muted)]">Ils ouvrent la même console (Rémi au piano, par exemple) et font tout, sauf supprimer la soirée.</p>
      {view.cohosts.map((c) => (
        <div key={c.memberId} className="flex items-center justify-between text-sm">
          <span>{c.name}</span>
          <button type="button" className="text-xs text-[var(--scn-muted)] underline" disabled={busy} onClick={() => void send({ type: "cohost", memberId: c.memberId, on: false })}>
            Retirer
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <select aria-label="Co-organisateur" value={choice} onChange={(e) => setChoice(e.target.value)} className="scn-field min-w-0 flex-1">
          <option value="">Un membre du CLHUB…</option>
          {candidates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="scn-btn"
          disabled={busy || !choice}
          onClick={async () => {
            if (!(await send({ type: "cohost", memberId: choice, on: true }))) setChoice("");
          }}
        >
          Ajouter
        </button>
      </div>
    </Section>
  );
}
