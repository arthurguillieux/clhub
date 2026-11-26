/**
 * The station itself, the same whatever scenario is loaded in it (« Antarctica, c'est le contenant ») —
 * drawn as on the sandbox mockup worked out with Arthur (23/11/2026): you come in through the airlock
 * into the HALL, and from the hall three doors: the DORMITORY (free), the BÊTA wing (locked: a key)
 * and ALPHA (never). Behind Bêta, a long corridor: archives, infirmary, generators, security room, and
 * the laboratory at the far end. One plan, in units of 1000 × 760, for the meneur's phone and the room.
 *
 * Scenarios give the doors their meaning (what opens them, by the door ids below); the station gives
 * their place.
 */

export type SpaceId = "hall" | "sas" | "dortoir" | "couloir" | "archives" | "infirmerie" | "generateurs" | "securite" | "labo" | "alpha";

export interface Space {
  id: SpaceId;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The scenario's zone it belongs to (its door, its sheet on the phone): the Bêta wing is one zone. */
  zone: string;
  /** What the meneur reads out on entering (« Le groupe est dans… »). */
  desc: string;
}

export const STATION_W = 1000;
export const STATION_H = 760;

export const SPACES: Space[] = [
  { id: "hall", name: "HALL", x: 340, y: 420, w: 320, h: 220, zone: "hall", desc: "L'accueil : le comptoir et son ordinateur, le coin détente. Trois portes, et le sas par où vous êtes arrivés." },
  { id: "sas", name: "SAS", x: 440, y: 640, w: 120, h: 90, zone: "sas", desc: "Combinaisons, la porte extérieure. Derrière : −45 °C." },
  { id: "dortoir", name: "DORTOIR", x: 40, y: 330, w: 300, h: 390, zone: "dortoir", desc: "Un long couloir, les chambres numérotées des sujets." },
  { id: "couloir", name: "AILE BÊTA", x: 450, y: 150, w: 100, h: 270, zone: "beta", desc: "Un long couloir. Des portes de chaque côté, une au fond." },
  { id: "archives", name: "ARCHIVES", x: 230, y: 160, w: 220, h: 120, zone: "beta", desc: "Des cartons, des classeurs, un bureau et son terminal. Un boîtier électrique au mur." },
  { id: "infirmerie", name: "INFIRMERIE", x: 330, y: 290, w: 120, h: 110, zone: "gamma", desc: "Trois lits, une armoire à pharmacie." },
  { id: "generateurs", name: "GÉNÉRATEURS", x: 550, y: 160, w: 220, h: 120, zone: "generateurs", desc: "Le bourdonnement des groupes, la jauge de carburant." },
  { id: "securite", name: "PC SÉCU.", x: 550, y: 290, w: 120, h: 110, zone: "securite", desc: "La radio, les écrans de surveillance, un terminal." },
  { id: "labo", name: "LABORATOIRE", x: 380, y: 30, w: 240, h: 120, zone: "labo", desc: "Des paillasses, une chambre froide, un terminal." },
  { id: "alpha", name: "ALPHA", x: 660, y: 380, w: 300, h: 340, zone: "alpha", desc: "" },
];

export interface StationDoor {
  /** The scenario's door id; `follows`: drawn open with that door (the archives open with the Bêta wing). */
  id: string;
  /** The two spaces it joins (the doors « seen » from where the group is). */
  a: SpaceId;
  b: SpaceId;
  follows?: string;
  letter: string;
  x: number;
  y: number;
  /** In a vertical wall (else horizontal). */
  v: boolean;
  /** Where its letter is written, outside the leaf. */
  side: "l" | "r";
  /** Which way it swings open: towards −x/−y (−1) or +x/+y (+1). */
  into: 1 | -1;
}

export const STATION_DOORS: StationDoor[] = [
  { id: "sas", a: "hall", b: "sas", letter: "Θ", x: 500, y: 640, v: false, side: "r", into: 1 },
  { id: "dortoir", a: "hall", b: "dortoir", letter: "Δ", x: 340, y: 600, v: true, side: "l", into: 1 },
  { id: "beta", a: "hall", b: "couloir", letter: "Β", x: 500, y: 420, v: false, side: "r", into: -1 },
  { id: "alpha", a: "hall", b: "alpha", letter: "Α", x: 660, y: 530, v: true, side: "r", into: 1 },
  { id: "archives", a: "couloir", b: "archives", follows: "beta", letter: "Κ", x: 450, y: 220, v: true, side: "l", into: -1 },
  { id: "gamma", a: "couloir", b: "infirmerie", letter: "Γ", x: 450, y: 345, v: true, side: "l", into: -1 },
  { id: "generateurs", a: "couloir", b: "generateurs", letter: "Ε", x: 550, y: 220, v: true, side: "r", into: 1 },
  { id: "securite", a: "couloir", b: "securite", letter: "Ζ", x: 550, y: 345, v: true, side: "r", into: 1 },
  { id: "labo", a: "couloir", b: "labo", letter: "Η", x: 500, y: 150, v: false, side: "r", into: -1 },
];

/** Where things stand on the plan: the terminals (by the room the scenario puts them in), the electrical box. */
export const SPOTS: Record<string, { x: number; y: number }> = {
  hall: { x: 433, y: 481 },
  beta: { x: 338, y: 249 },
  archives: { x: 338, y: 249 },
  securite: { x: 600, y: 320 },
  labo: { x: 451, y: 78 },
  circuit: { x: 628, y: 446 },
};

/** Whether a space is lit/known for the room: the hall when lit, the dormitory behind its door and the light, the rest behind their door. */
export function spaceShown(id: SpaceId, light: boolean, doors: Record<string, boolean>): boolean {
  const zone = SPACES.find((s) => s.id === id)!.zone;
  if (id === "hall") return light;
  if (id === "dortoir") return light && !!doors.dortoir;
  return !!doors[zone];
}

/** The dormitory's rooms: two columns (odd on the left, even on the right), as many rows as needed. */
export function dormRooms(count: number): { n: number; x: number; y: number; w: number; h: number }[] {
  const rows = Math.ceil(count / 2);
  const top = 372;
  const bottom = 712;
  const rowH = (bottom - top) / rows;
  return Array.from({ length: count }, (_, i) => ({ n: i + 1, x: 54 + (i % 2) * 144, y: top + Math.floor(i / 2) * rowH, w: 128, h: rowH - 6 }));
}

/** The other side of a door, seen from a space. */
export const otherSide = (d: StationDoor, from: SpaceId): SpaceId => (d.a === from ? d.b : d.a);
/** The doors one sees from a space. */
export const doorsFrom = (space: SpaceId) => STATION_DOORS.filter((d) => d.a === space || d.b === space);

/**
 * The furniture one can search, room by room (three hiding places at most per room, V1.4): each one
 * with its gestures (on/off: « Soulever le clavier » / « Reposer le clavier »). A gesture's key is
 * `prop.gesture` (« ordi.clavier »): the scenario puts its things behind those keys (or nothing).
 */
export interface Prop {
  id: string;
  space: SpaceId;
  name: string;
  gestures: { id: string; on: string; off: string }[];
}

const one = (id: string, space: SpaceId, name: string, on: string, off = "Remettre en place"): Prop => ({ id, space, name, gestures: [{ id: "fouiller", on, off }] });

export const PROPS: Prop[] = [
  {
    id: "ordi",
    space: "hall",
    name: "L'ordinateur de l'accueil",
    gestures: [
      { id: "clavier", on: "Soulever le clavier de l'ordinateur", off: "Reposer le clavier" },
      { id: "souris", on: "Soulever la souris", off: "Reposer la souris" },
    ],
  },
  one("comptoir", "hall", "Le comptoir", "Ouvrir le tiroir du comptoir", "Fermer le tiroir"),
  one("coffre", "sas", "Le coffre de survie", "Ouvrir le coffre de survie", "Refermer le coffre"),
  one("casiers", "sas", "Les casiers des combinaisons", "Fouiller les casiers des combinaisons"),
  one("motoneige", "sas", "La motoneige", "Soulever la bâche de la motoneige", "Remettre la bâche"),
  one("classeur", "archives", "Le classeur rouge", "Ouvrir le classeur rouge", "Refermer le classeur"),
  one("carton", "archives", "Le carton sans étiquette", "Ouvrir le carton sans étiquette", "Refermer le carton"),
  one("noel", "archives", "Le carton « Noël »", "Ouvrir le carton « Noël »", "Refermer le carton"),
  one("armoire", "infirmerie", "L'armoire à pharmacie", "Ouvrir l'armoire à pharmacie", "Refermer l'armoire"),
  one("trousse", "infirmerie", "La trousse sous le lit", "Tirer la trousse sous le lit", "Remettre la trousse"),
  one("lit", "infirmerie", "Le lit défait", "Fouiller le lit défait"),
  one("caisse", "generateurs", "La caisse à outils", "Ouvrir la caisse à outils", "Refermer la caisse"),
  one("carburant", "generateurs", "Le registre de carburant", "Lire le registre de carburant", "Refermer le registre"),
  one("corps", "securite", "Le corps dans le fauteuil", "S'approcher du corps", "S'écarter"),
  one("cameras", "securite", "Le registre des caméras", "Lire le registre des caméras", "Refermer le registre"),
];
export const propsIn = (space: SpaceId) => PROPS.filter((p) => p.space === space);
/** Every hiding place's key, its piece of furniture, and its gesture. */
export const SPOTS_TO_SEARCH = PROPS.flatMap((p) => p.gestures.map((g) => ({ key: `${p.id}.${g.id}`, prop: p, gesture: g })));
/** The space a scenario's zone (its door id) leads to, for « the day's door » moving the group. */
export const spaceOfZone = (zone: string): SpaceId => (zone === "beta" ? "archives" : zone === "gamma" ? "infirmerie" : (SPACES.find((x) => x.id === zone)?.id ?? "hall"));
