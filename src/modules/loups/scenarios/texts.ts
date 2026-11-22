/**
 * The texts the meneur reads aloud (prologue, nights, wake-ups, rooms, events, endings): the file that
 * comes with the scenario, replaced by an imported one, retouched by hand. Pure: parsing, the
 * variables from the journal, the variants that apply, the import summary.
 */
import { doorProposals, momentOf, nightSteps, type NightStepId, type Setup, type State } from "./engine";
import defaults from "./textes_antarctica.json";
import type { ScenarioDef } from "./types";

export interface ReadText {
  id: string;
  partie: string;
  titre: string;
  quand: string;
  texte: string;
}

export interface TextFile {
  scenario?: string;
  version?: string;
  date?: string;
  conventions?: unknown;
  textes: ReadText[];
}

export const DEFAULT_TEXTS: TextFile = defaults as TextFile;

/** The file in force: the imported one (or the scenario's), with the hand edits on top. */
export function resolveTexts(imported: TextFile | undefined, edited: Record<string, string> | undefined): ReadText[] {
  const base = (imported ?? DEFAULT_TEXTS).textes;
  return base.map((t) => (edited?.[t.id] !== undefined ? { ...t, texte: edited[t.id]! } : t));
}

/** What an import changes, said before it replaces anything. */
export function importSummary(before: ReadText[], after: ReadText[]): { added: string[]; changed: string[]; removed: string[] } {
  const old = new Map(before.map((t) => [t.id, t]));
  const next = new Map(after.map((t) => [t.id, t]));
  return {
    added: after.filter((t) => !old.has(t.id)).map((t) => t.id),
    changed: after.filter((t) => old.has(t.id) && JSON.stringify(old.get(t.id)) !== JSON.stringify(t)).map((t) => t.id),
    removed: before.filter((t) => !next.has(t.id)).map((t) => t.id),
  };
}

/** Reads an imported JSON file: the texts, or why it isn't one. */
export function parseTextFile(raw: string): { ok: true; file: TextFile } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Ce fichier n'est pas du JSON lisible." };
  }
  const textes = (data as { textes?: unknown })?.textes;
  if (!Array.isArray(textes) || textes.length === 0) return { ok: false, error: "Le fichier ne contient pas de liste « textes »." };
  const clean: ReadText[] = [];
  for (const t of textes as Record<string, unknown>[]) {
    if (typeof t?.id !== "string" || typeof t.texte !== "string") return { ok: false, error: "Un texte n'a pas d'« id » ou de « texte »." };
    clean.push({ id: t.id.trim(), partie: String(t.partie ?? ""), titre: String(t.titre ?? ""), quand: String(t.quand ?? ""), texte: t.texte });
  }
  if (new Set(clean.map((t) => t.id)).size !== clean.length) return { ok: false, error: "Deux textes ont le même identifiant." };
  const d = data as Record<string, unknown>;
  return { ok: true, file: { scenario: d.scenario as string | undefined, version: d.version as string | undefined, date: d.date as string | undefined, conventions: d.conventions, textes: clean } };
}

// ───────── Reading ─────────

export type Block = { kind: "read" | "stage" | "variant"; label?: string; text: string };

const STAGE_MARKS = ["🎹", "💡", "🔊", "🖥️"];

/** The text cut in paragraphs: what's read, the stage directions, the variants (with their heading). */
export function blocks(texte: string): Block[] {
  return texte
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p): Block => {
      const variant = p.match(/^\*((?:Si|Variante)\b[^*]*?)\s*:\s*\*\s*([\s\S]*)$/);
      if (variant) return { kind: "variant", label: variant[1]!.trim(), text: variant[2]!.trim() };
      if (STAGE_MARKS.some((m) => p.startsWith(m)) || /^\*[^*][\s\S]*\*$/.test(p)) return { kind: "stage", text: p.replace(/^\*([\s\S]*)\*$/, "$1") };
      return { kind: "read", text: p };
    });
}

/** Which variant applies; null when the console can't tell (they're all shown). */
export function pickVariant(id: string, labels: string[], ctx: { night: number; targetInfected?: boolean | null; volunteers?: boolean | null }): string | null {
  if (id === "NUIT-02" || id === "NUIT-03") {
    // Night 2 → a, 3 → b, 4 → c…: never the same twice in a loop.
    const variants = labels.filter((l) => l.startsWith("Variante"));
    if (variants.length && ctx.night >= 2) return variants[(ctx.night - 2) % variants.length] ?? null;
  }
  if (id === "JOUR-15" && ctx.targetInfected !== null && ctx.targetInfected !== undefined) {
    return labels.find((l) => (ctx.targetInfected ? /contamin/i.test(l) : /saine/i.test(l))) ?? null;
  }
  if (id === "ARR-06" && ctx.volunteers === false) return labels.find((l) => /personne/i.test(l)) ?? null;
  return null;
}

/** Splits a paragraph into plain text, {variables} (replaced when known) and [the meneur's choices]. */
export function inline(text: string, vars: Record<string, string | null>): { text: string; kind: "plain" | "var" | "unknown" | "choice" | "bold" }[] {
  const out: { text: string; kind: "plain" | "var" | "unknown" | "choice" | "bold" }[] = [];
  const re = /\{([^}]+)\}|\[([^\]]+)\]|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), kind: "plain" });
    if (m[1] !== undefined) {
      const value = vars[m[1]];
      out.push(value ? { text: value, kind: "var" } : { text: m[0], kind: "unknown" });
    } else if (m[2] !== undefined) out.push({ text: m[0], kind: "choice" });
    else out.push({ text: m[3]!, kind: "bold" });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: "plain" });
  return out.map((p) => (p.kind === "plain" ? { ...p, text: p.text.replace(/\*([^*]+)\*/g, "$1") } : p));
}

// ───────── The right text at the right moment ─────────

/** The {variables} of the texts, from the journal; null when unknown (the {variable} stays visible). */
export function textVars(s: State, id?: string): Record<string, string | null> {
  const name = (pid: string | null | undefined) => (pid ? (s.players.find((p) => p.id === pid)?.name ?? null) : null);
  const night = s.phase === "night";
  const holderOf = (item: string) => name(s.items[item]?.holder);
  // A holder who died at this moment: OBJ-03 calls them {victime}.
  const deadHolder = deadHolders(s)[0];
  const porteur = id === "NUIT-12" ? holderOf("bandes") : id === "NUIT-16" ? holderOf("vie") : id === "OBJ-02" ? holderOf("pistolet") : (holderOf("bandes") ?? holderOf("vie") ?? holderOf("pistolet"));
  const past = s.past[0];
  return {
    victime: id === "OBJ-03" && deadHolder ? name(deadHolder.holder) : night ? name(s.tonight.victim) : name(s.announced[0]),
    victime2: night ? name(s.tonight.death) : name(s.announced[1]),
    exilé: name(s.lastExile?.player),
    chef: name(s.chief ?? (s.chiefToConfirm ? s.chiefB1 : s.formerChief)),
    chef_b1: name(s.chiefB1),
    porteur,
    tireur: name(s.lastShot?.shooter),
    cible: name(s.lastShot?.target),
    enfermé: name(night ? s.tonight.panic : s.panicNext),
    quarantaine1: name(s.quarantine[0]),
    quarantaine2: name(s.quarantine[1]),
    morts_b1: past ? past.players.filter((p) => p.status !== "alive").map((p) => name(p.id)).filter(Boolean).join(", ") || null : null,
  };
}

/** Who died just now: at this moment, or last night when it's the morning after. */
const diedNow = (s: State, at: string | null) => !!at && (at === momentOf(s) || (s.phase === "day" && at === `Boucle ${s.loop} · Nuit ${s.round}`));

/** Items still in use whose holder just died: they hand them over, in front of everyone (OBJ-03). */
function deadHolders(s: State) {
  return Object.values(s.items).filter((i) => !i.used && i.holder && s.players.some((p) => p.id === i.holder && p.status !== "alive" && diedNow(s, p.diedAt)));
}

/** Whether something was written in the journal at this very moment (« Boucle 1 · Jour 2 »). */
const happened = (s: State, start: string) => s.log.some((l) => l.at === momentOf(s) && l.text.startsWith(start));

/**
 * The texts of this moment, in reading order, and the one to open first. An empty list means the
 * console can't tell: it opens the list of all the texts rather than a wrong one.
 */
export function suggestTexts(def: Pick<ScenarioDef, "items" | "dayActions" | "dayPlan">, setup: Pick<Setup, "params" | "events">, s: State): { ids: string[]; at: number } {
  const only = (ids: (string | false | null | undefined)[], at = 0) => {
    const list = ids.filter((x): x is string => !!x);
    return { ids: list, at: Math.min(at, Math.max(0, list.length - 1)) };
  };
  if (s.phase === "welcome") return only(["OUV-01"]);
  if (s.phase === "bus") return s.loop === 1 ? only(["PRO-01", "PRO-02", "PRO-03", "PRO-04"]) : only(["PRO-05"]);
  if (s.phase === "arrival") {
    if (s.loop >= 2) return only(["ARR-10", "ARR-11", "ARR-12", "MARGA-02"]);
    const ids = ["ARR-01", "ARR-02", "ARR-03", "ARR-04", "ARR-05", "ARR-06", "ARR-07"];
    return only(ids, s.chief ? 5 : s.vote?.kind === "chief" ? 4 : 0);
  }
  if (s.phase === "night") {
    const steps = nightSteps(s, setup.params, def);
    const holder = (item: string) => {
      const h = s.items[item];
      return !!h?.holder && !h.used && s.players.find((p) => p.id === h.holder)?.status === "alive";
    };
    const first = s.round === 1;
    const byStep: Record<NightStepId, string> = {
      pz: "NUIT-13",
      handover: "NUIT-10",
      panic: "NUIT-11",
      tapes: "NUIT-12",
      infect: s.round >= 4 ? "NUIT-14" : "NUIT-13",
      victim: "NUIT-15",
      items: "NUIT-16",
      dead: "NUIT-17",
    };
    const ids = first
      ? ["NUIT-01", "NUIT-13", "NUIT-15", holder("vie") || holder("mort") ? "NUIT-16" : null, "NUIT-18"]
      : [
          s.loop === 1 ? "NUIT-02" : "NUIT-03",
          steps.includes("handover") && "NUIT-10",
          steps.includes("panic") && "NUIT-11",
          steps.includes("tapes") && "NUIT-12",
          s.round >= 4 ? "NUIT-14" : "NUIT-13",
          "NUIT-15",
          steps.includes("items") && "NUIT-16",
          steps.includes("dead") && "NUIT-17",
          "NUIT-18",
        ];
    const list = ids.filter((x): x is string => !!x);
    const current = steps.find((x) => !s.tonight.done.includes(x));
    const at = s.tonight.done.length === 0 ? 0 : current ? list.indexOf(byStep[current]) : list.indexOf("NUIT-18");
    return only(list, Math.max(0, at));
  }
  if (s.phase === "day") {
    const event = setup.events.find((e) => e.id === s.event);
    const last = def.dayActions.find((a) => a.id === s.lastAction);
    const firstArchives = last?.zone === "beta" && s.actionsDone.filter((id) => def.dayActions.find((a) => a.id === id)?.zone === "beta").length === 1;
    const secret = new Set(def.items.filter((i) => i.family === "secret").map((i) => i.id).concat("seringues"));
    const exiled = happened(s, "Exil :");
    const chiefDied = happened(s, "Le chef est mort") || (exiled && !!s.lastExile?.chief);
    const holderDied = deadHolders(s).length > 0;
    const final = s.loop >= 2 && s.round >= 4;
    // The doors as they were offered this morning, before today's choice opened anything.
    const beforeDoor = last ? { ...s, actionsDone: s.actionsDone.filter((x) => x !== last.id), flags: { ...s.flags, ...Object.fromEntries((last.gives ?? []).map((f) => [f, false])) } } : s;
    const ids = [
      s.announced.length === 0 ? "JOUR-03" : s.announced.length === 1 ? "JOUR-01" : "JOUR-02",
      event && "JOUR-04",
      event?.text,
      final ? "B2-J4" : doorProposals(def, beforeDoor).includes("fouiller") ? "JOUR-06" : "JOUR-05",
      firstArchives && "SALLE-03",
      last?.text,
      happened(s, "Porte Α") && "SALLE-10",
      s.foundToday.some((x) => secret.has(x)) && "OBJ-01",
      s.foundToday.includes("pistolet") && "OBJ-02",
      happened(s, "Tir du pistolet") && "JOUR-15",
      "JOUR-10",
      "JOUR-11",
      "JOUR-12",
      exiled && s.lastExile?.chief && s.lastExile.healthy && "JOUR-13",
      chiefDied && "JOUR-14",
      holderDied && "OBJ-03",
      "JOUR-16",
    ];
    const list = ids.filter((x): x is string => !!x);
    const at = exiled
      ? list.indexOf("JOUR-12") + 1
      : happened(s, "Tir du pistolet")
        ? list.indexOf("JOUR-15")
        : s.lastAction
          ? list.indexOf(firstArchives ? "SALLE-03" : (last?.text ?? "JOUR-10"))
          : s.vote?.kind === "door"
            ? list.findIndex((x) => x === "JOUR-05" || x === "JOUR-06" || x === "B2-J4")
            : 0;
    return only(list, Math.max(0, at));
  }
  if (s.phase === "loopEnd") return only([s.winner === "village" ? "FIN1-V" : "FIN1-M", "REBOOT-01"]);
  if (s.phase === "good") return only(["FIN-BONNE", "FIN-REEL"]);
  if (s.phase === "bad") return only(["FIN-MAUVAISE", "FIN-REEL"]);
  return { ids: [], at: 0 };
}

/** The night 1 version of NUIT-13: from « La bête a besoin d'une meute » on. */
export function fromPhrase(texte: string, phrase: string): string {
  const i = texte.indexOf(phrase);
  return i < 0 ? texte : texte.slice(texte.lastIndexOf("\n\n", i) + (texte.lastIndexOf("\n\n", i) < 0 ? 0 : 2));
}

/**
 * FAILLE-01's variant for the latest fault: never the same twice in the evening, all of them used
 * before starting again; a to d first in loop 1, e and f first in loop 2. Replayed from the faults
 * already triggered, so it never depends on the phone.
 */
export function faultVariant(labels: string[], faults: { at: string }[]): string | null {
  if (labels.length === 0 || faults.length === 0) return null;
  const late = (l: string) => /variante [ef]\b/i.test(l);
  let used: string[] = [];
  let pick: string | null = null;
  for (const f of faults) {
    if (used.length >= labels.length) used = [];
    const loop = Number(f.at.match(/Boucle (\d+)/)?.[1] ?? 1);
    const free = labels.filter((l) => !used.includes(l));
    const preferred = free.filter((l) => (loop >= 2 ? late(l) : !late(l)));
    pick = (preferred[0] ?? free[0])!;
    used.push(pick);
  }
  return pick;
}
