"use client";

import type { ReactNode } from "react";
import type { ConsoleView } from "@/modules/loups/scenarios/data";
import { flagName } from "@/modules/loups/scenarios/engine";
import { PROPS, SPACES, STATION_DOORS, spaceShown } from "@/modules/loups/scenarios/station";
import type { PublicScenario } from "@/modules/loups/scenarios/types";
import { SheetFrame } from "./Station";

/**
 * « La bible de la base »: everything that exists in the station, in one place, to know it by heart —
 * its rooms and doors, its furniture and hiding places (with what the scenario put there), the things
 * one finds, the terminals and their files, the sounds, the effects and the screens; then what the loaded
 * scenario adds. Read only: nothing here acts on the room.
 */
export function BibleSheet({ def, view, onClose }: { def: PublicScenario; view: ConsoleView; onClose: () => void }) {
  const s = view.state;
  const box = def.sandbox;
  const sounds = def.media.filter((m) => m.kind === "audio");
  const visuals = def.media.filter((m) => m.kind !== "audio");
  const categories = [...new Set(sounds.map((m) => m.category ?? "Autres"))];
  return (
    <SheetFrame title="LA BIBLE DE LA BASE" sub="Tout ce qui existe dans la station. Rien ici n'agit sur la salle." onClose={onClose}>
      <Part title="Les pièces" count={SPACES.length} open>
        {SPACES.map((sp) => {
          const doors = STATION_DOORS.filter((d) => d.b === sp.id).map((d) => d.letter);
          const shown = sp.id === "alpha" ? false : spaceShown(sp.id, s.light, s.doors);
          return (
            <Item key={sp.id} title={`${sp.name}${doors.length ? ` · ${doors.join(" ")}` : ""}`} tag={s.at === sp.id ? "le groupe est ici" : shown ? "connue" : sp.id === "alpha" ? "jamais" : "non cartographiée"}>
              {sp.desc || "Ce que la base cache."}
            </Item>
          );
        })}
      </Part>

      <Part title="Les portes" count={STATION_DOORS.length}>
        {STATION_DOORS.map((d) => {
          const door = def.doors.find((x) => x.id === (d.follows ?? d.id));
          const from = SPACES.find((x) => x.id === d.a)!.name;
          const to = SPACES.find((x) => x.id === d.b)!.name;
          const lock = d.follows ? "s'ouvre avec l'aile" : door?.locked ? "ne s'ouvre jamais" : door?.requires ? `il faut ${flagName(door.requires)}` : "libre";
          return (
            <Item key={d.id} title={`${d.letter} · ${from} → ${to}`} tag={s.doors[door?.id ?? ""] ? "ouverte" : "fermée"}>
              {lock}
            </Item>
          );
        })}
      </Part>

      <Part title="Les meubles et leurs cachettes" count={PROPS.reduce((n, p) => n + p.gestures.length, 0)}>
        {SPACES.filter((sp) => PROPS.some((p) => p.space === sp.id)).map((sp) => (
          <div key={sp.id} className="flex flex-col gap-1">
            <p className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-muted)]">{sp.name}</p>
            {PROPS.filter((p) => p.space === sp.id).flatMap((p) =>
              p.gestures.map((g) => {
                const key = `${p.id}.${g.id}`;
                const c = s.opened[key] ?? box?.cachettes[key];
                return (
                  <Item key={key} title={g.on} tag={s.opened[key] ? "fouillée" : c ? c.texte : "vide"}>
                    {c ? `${c.contenu}${c.objet ? ` → ${box?.objets[c.objet]?.name ?? c.objet}` : ""}` : "Rien dans ce scénario."}
                  </Item>
                );
              }),
            )}
          </div>
        ))}
      </Part>

      {box && (
        <Part title="Les objets à trouver" count={Object.keys(box.objets).length}>
          {Object.entries(box.objets).map(([id, o]) => (
            <Item key={id} title={o.name} tag={s.inventory.includes(id) ? "trouvé" : "pas encore"}>
              {[o.flag && `ouvre : ${flagName(o.flag)}`, o.items?.length && "à confier à un joueur", o.secret && "objet secret (« porteur inconnu » à l'écran)"].filter(Boolean).join(" · ") || "un indice"}
            </Item>
          ))}
          {Object.entries(box.codes ?? {}).map(([id, code]) => (
            <Item key={id} title={`Code des ${id}`} tag="code">
              {code}
            </Item>
          ))}
        </Part>
      )}

      <Part title="Les terminaux et leurs fichiers" count={def.terminals.length}>
        {def.terminals.map((t) => {
          const lock = box?.passwords[t.id];
          return (
            <div key={t.id} className="flex flex-col gap-1">
              <Item title={t.label} tag={lock ? (s.unlocked.includes(t.id) ? "déverrouillé" : `mot de passe : ${lock.word}`) : "libre"}>
                {lock?.hint ?? `Dans : ${t.hint}.`}
              </Item>
              <ul className="ml-3 flex flex-col gap-0.5 text-xs text-[var(--scn-muted)]">
                {t.files.map((f) => (
                  <li key={f.id}>
                    <span className="font-mono text-[var(--scn-txt)]">{view.setup.files?.[f.id]?.name || f.name}</span> · {f.kind === "video" ? "vidéo" : f.kind === "recording" ? "enregistrement de la salle" : f.kind === "audio" ? "son" : f.kind === "image" ? "image" : f.kind === "registry" ? "registre des sujets" : "texte"}
                    {view.setup.files?.[f.id]?.date || f.date ? ` · ${view.setup.files?.[f.id]?.date || f.date}` : ""}
                    {f.fault ? " · faille" : ""}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Part>

      <Part title="Les sons" count={sounds.length}>
        {categories.map((c) => (
          <div key={c} className="flex flex-col gap-1">
            <p className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-muted)]">{c.toUpperCase()}</p>
            {sounds
              .filter((m) => (m.category ?? "Autres") === c)
              .map((m) => (
                <Item key={m.id} title={m.label} tag={m.loop ? "en boucle" : "une fois"}>
                  <span className="font-mono">{m.file}</span>
                  {def.base.welcomeSound === m.id ? " · joue sous l'écran d'accueil" : ""}
                </Item>
              ))}
          </div>
        ))}
      </Part>

      <Part title="Les images et vidéos" count={visuals.length}>
        {visuals.map((m) => (
          <Item key={m.id} title={m.label} tag={m.kind === "video" ? "vidéo" : "image"}>
            <span className="font-mono">{m.file}</span>
            {m.required ? " · obligatoire" : ""}
          </Item>
        ))}
      </Part>

      <Part title="Les effets, les écrans, les outils" count={EFFECTS.length}>
        {EFFECTS.map(([title, where, what]) => (
          <Item key={title} title={title} tag={where}>
            {what}
          </Item>
        ))}
      </Part>

      <Part title={`Ce que ${def.short ?? def.title} ajoute`} count={def.events.length + def.items.length + def.faults.length}>
        <p className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-muted)]">LES ÉVÉNEMENTS DU JOUR</p>
        {def.events.map((e) => (
          <Item key={e.id} title={e.name} tag={e.text ?? ""}>
            {e.rule}
          </Item>
        ))}
        <p className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-muted)]">LES POUVOIRS</p>
        {def.items.map((i) => (
          <Item key={i.id} title={i.name} tag={i.family === "public" ? "public" : i.family === "secret" ? "secret" : "dans une pièce"}>
            {ITEM_EFFECT[i.effect] ?? ""}
          </Item>
        ))}
        <p className="text-[0.66rem] font-bold tracking-[0.14em] text-[var(--scn-muted)]">LES FAILLES</p>
        {def.faults.map((f) => (
          <Item key={f.id} title={f.title} tag={`boucle ${f.loops.join(", ")}`}>
            {f.missed}
          </Item>
        ))}
      </Part>
    </SheetFrame>
  );
}

const ITEM_EFFECT: Record<string, string> = {
  pistol: "Une cartouche par boucle, de jour : sur un contaminé, il tombe ; sur un sain, le tireur part avec lui.",
  tapes: "Chaque nuit, le porteur voit le camp d'un joueur.",
  life: "Sauve la victime de la nuit, une fois par boucle.",
  death: "Tue un joueur la nuit, une fois par boucle.",
  test: "À l'infirmerie : le camp d'un joueur, devant tous.",
  radio: "Au PC sécurité : le nombre de contaminés en vie.",
};

/** What the base can do on its own, wherever it lives on the phone. */
const EFFECTS: [string, string, string][] = [
  ["Allumer / éteindre le hall", "Toute la base", "Les néons démarrent en clignotant."],
  ["Coupure 4 s", "Toute la base", "Le générateur lâche, la lumière vacille."],
  ["Délestage", "Toute la base", "Tout est noir, une lampe torche erre."],
  ["Blizzard", "Toute la base", "La neige tombe sur l'écran."],
  ["Aurore", "Toute la base", "Le ciel s'allume."],
  ["Glitch", "Toute la base", "L'image saute une fois (magenta, cyan)."],
  ["Alarme", "Toute la base", "Une fois."],
  ["Intrusion écrite", "Toute la base", "Le texte s'écrit lettre par lettre."],
  ["Intrusion dessinée", "Toute la base", "Le dessin se trace en magenta."],
  ["Terminaux", "Toute la base, et la fiche de leur pièce", "Afficher, fermer ; les fichiers, la lecture."],
  ["Failles du scénario", "Toute la base", "Comme un son : toucher l'allume, retoucher la retire."],
  ["Minuteurs", "Toute la base", "Débat 5 min, chrono 1 min : pause, ± minutes."],
  ["Jauge de carburant", "Toute la base, et Générateurs", "Se vide à l'écran ; à zéro, la lumière vacille."],
  ["Boîtier de la panic room", "Archives", "Quatre interrupteurs, puis mise sous tension (ou court-circuit)."],
  ["Enregistrer la salle 30 s", "Toute la base", "Le micro ; le fichier apparaît sur un terminal."],
  ["À l'écran", "En haut de la console", "Tout ce qui est allumé, avec sa croix pour l'éteindre."],
  ["Vue suivie / vue globale", "Le groupe", "La salle suit le groupe ou voit toute la base."],
  ["Accueil", "Écran", "La photo, « STATION ANTARCTICA », le vent."],
  ["Plan / plan seul", "Écran", "La base en direct."],
  ["En attente de connexion", "Écran", "L'écran de réserve."],
  ["Chargement du scénario", "Écran", "Seulement si on le lance (scénario chargé)."],
  ["Redémarrer la station", "Écran", "Tout comme au départ, avant la partie."],
  ["Stop", "Barre du bas", "Tout ce qui joue s'arrête ; terminal, boîtier et meuble se ferment. Lumière et portes restent."],
  ["Annuler", "Barre du bas", "Le dernier geste, à l'envers."],
];

function Part({ title, count, open = false, children }: { title: string; count: number; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="rounded-xl border border-[#1f3a4b] bg-[#0c141b]">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-sm font-bold text-[var(--scn-ice)]">
        {title}
        <span className="scn-chip">{count}</span>
      </summary>
      <div className="flex flex-col gap-1.5 border-t border-[#1f3a4b] p-3">{children}</div>
    </details>
  );
}

function Item({ title, tag, children }: { title: string; tag?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#1f3a4b] px-2.5 py-1.5">
      <p className="flex items-baseline justify-between gap-2 text-sm">
        <b className="text-[var(--scn-txt)]">{title}</b>
        {tag && <span className="shrink-0 text-[0.66rem] text-[var(--scn-amber)]">{tag}</span>}
      </p>
      <p className="text-xs text-[var(--scn-muted)]">{children}</p>
    </div>
  );
}
