/**
 * « Simuler une partie »: twenty fictive players and a journal written up to a chosen moment, through
 * the engine like a real evening (no shortcut: the console can undo it action by action).
 */
import { SPOTS_TO_SEARCH } from "./station";
import { alive, apply, doorProposals, initialState, nightSteps, pack, proposals, type Action, type Setup, type State } from "./engine";
import type { ScenarioDef } from "./types";

export const START_POINTS = [
  { id: "b1-arrival", label: "Arrivée de la boucle 1" },
  { id: "b1-day3", label: "Boucle 1, jour 3" },
  { id: "reboot", label: "Reboot entre les deux boucles" },
  { id: "b2-arrival", label: "Arrivée de la boucle 2" },
  { id: "b2-day3", label: "Boucle 2, jour 3 (laboratoire)" },
] as const;
export type StartPoint = (typeof START_POINTS)[number]["id"];

const WOMEN = ["Camille", "Léa", "Manon", "Chloé", "Emma", "Inès", "Sarah", "Julie", "Pauline", "Margaux", "Clara", "Lucie", "Anaïs", "Élise", "Juliette", "Mathilde", "Charlotte", "Océane", "Laura", "Marion"];
const MEN = ["Lucas", "Hugo", "Thomas", "Nicolas", "Maxime", "Antoine", "Julien", "Romain", "Clément", "Quentin", "Baptiste", "Louis", "Théo", "Paul", "Adrien", "Benjamin", "Simon", "Victor", "Gabriel", "Mathis"];

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const pick = <T>(list: T[], random: () => number): T | undefined => list[Math.floor(random() * list.length)];

/** 20 French first names, women and men mixed, none from a real evening; the room order is drawn too. */
export function simulatedPlayers(random: () => number, taken: string[]): Setup["players"] {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  const women = shuffle(WOMEN.filter((n) => !used.has(n.toLowerCase())), random);
  const men = shuffle(MEN.filter((n) => !used.has(n.toLowerCase())), random);
  // Ten of each when they're free; one side fills in for the other, and the room order is drawn.
  const half = Math.min(10, women.length);
  const names = shuffle([...women.slice(0, half), ...men.slice(0, 20 - half), ...women.slice(half)].slice(0, 20), random);
  return names.map((name, i) => ({ id: `p${i + 1}`, name }));
}

/** The journal up to the chosen moment, each action checked against the engine as it goes. */
export function simulatedJournal(def: ScenarioDef, setup: Setup, start: StartPoint, random: () => number): Action[] {
  const actions: Action[] = [];
  let s: State = initialState(def, setup);
  const go = (a: Action) => {
    actions.push(a);
    s = apply(def, setup, s, a);
  };
  // The chief stays out of the pack's way and of the exile: the simulation never locks the base by chance.
  const healthy = () => alive(s).filter((p) => !p.infected && p.id !== s.chief);

  const arrive = () => {
    if (s.phase === "welcome") go({ t: "start" });
    go({ t: "arrive" });
    if (!s.light) go({ t: "light", on: true });
    if (!s.doors.dortoir) go({ t: "door", door: "dortoir", open: true });
    if (s.chiefToConfirm) go({ t: "chiefConfirm" });
    else {
      // Four volunteers, the vote by moving, the elected one.
      const volunteers = shuffle(alive(s), random).slice(0, 4).map((p) => p.id);
      go({ t: "vote", kind: "chief", options: volunteers });
      go({ t: "voteResult", choice: pick(volunteers, random)! });
    }
    // Loop 2: what was found is handed out again.
    for (const item of handOut()) go({ t: "giveItem", item, player: pick(healthy(), random)!.id });
    go({ t: "patientZero", player: pick(healthy(), random)!.id });
  };
  const handOut = () => {
    const out: string[] = [];
    if (s.found.includes("pistolet") && !s.items.pistolet?.holder) out.push("pistolet");
    if (s.found.includes("bandes") && !s.items.bandes?.holder) out.push("bandes");
    if (s.found.includes("seringues") && !s.items.vie?.holder) out.push("seringues");
    return out;
  };
  const night = () => {
    go({ t: "night" });
    for (const step of nightSteps(s, setup.params, def)) {
      if (step === "tapes") go({ t: "tapes", target: pick(alive(s), random)!.id });
      if (step === "infect") go({ t: "infect", player: pick(healthy(), random)!.id });
      if (step === "victim") go({ t: "victim", player: pick(healthy(), random)!.id });
      if (step === "pz" || step === "handover" || step === "panic" || step === "items") go({ t: "skip", step });
      if (step === "dead") {
        const proposed = proposals(s, setup);
        if (proposed.length) {
          go({ t: "vote", kind: "dead", options: proposed });
          go({ t: "voteResult", choice: pick(proposed, random)! });
        } else go({ t: "skip", step });
      }
    }
    go({ t: "dawn" });
  };
  /** The day: the door (the plan's, the second one on day 2: the archives' search), the items found handed out, the exile. */
  const day = (exile: boolean) => {
    const doors = doorProposals(def, s);
    if (doors.length) {
      go({ t: "vote", kind: "door", options: doors });
      go({ t: "voteResult", choice: (s.round === 2 ? doors[1] : doors[0]) ?? doors[0]! });
      // V1.4: the group searches one hiding place of the room, the one with a thing to hand out first.
      const spots = SPOTS_TO_SEARCH.filter((x) => x.prop.space === s.at && def.sandbox?.cachettes[x.key]?.objet && !s.inventory.includes(def.sandbox.cachettes[x.key]!.objet!));
      const best = spots.find((x) => def.sandbox?.objets[def.sandbox.cachettes[x.key]!.objet!]?.items?.length) ?? spots[0];
      if (best) go({ t: "gesture", key: best.key, on: true });
    }
    for (const item of handOut()) go({ t: "giveItem", item, player: pick(healthy(), random)!.id });
    if (exile) go({ t: "exile", player: pick(healthy(), random)?.id ?? null });
  };
  // Three nights; the village exiles someone healthy each day, so neither side wins before day 3.
  const toDay3 = () => {
    for (let n = 1; n <= 3; n++) {
      night();
      if (n < 3) day(true);
    }
  };

  arrive();
  if (start === "b1-arrival") return actions;
  toDay3();
  if (start === "b1-day3") return actions;
  day(true);
  go({ t: "endLoop", winner: pack(s).length >= alive(s).length - pack(s).length ? "meute" : "village" });
  if (start === "reboot") return actions;
  go({ t: "reboot" });
  arrive();
  if (start === "b2-arrival") return actions;
  toDay3();
  return actions;
}
