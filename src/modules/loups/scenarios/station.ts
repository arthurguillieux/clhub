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
 * The furniture one can search, with its gestures (each one on/off: « Soulever le clavier » /
 * « Reposer le clavier »). A gesture's key is `prop.gesture` (« ordi.clavier »): the scenario hides
 * its things behind those keys. A `computer` asks for a password before showing its files.
 */
export interface Prop {
  id: string;
  space: SpaceId;
  name: string;
  gestures: { id: string; on: string; off: string }[];
  computer?: { terminal: string; gesture: string };
}

export const PROPS: Prop[] = [
  {
    id: "ordi",
    space: "hall",
    name: "L'ordinateur de l'accueil",
    gestures: [
      { id: "allume", on: "Allumer l'écran", off: "Éteindre l'écran" },
      { id: "clavier", on: "Soulever le clavier", off: "Reposer le clavier" },
      { id: "souris", on: "Soulever la souris", off: "Reposer la souris" },
    ],
    computer: { terminal: "accueil", gesture: "allume" },
  },
  { id: "comptoir", space: "hall", name: "Le comptoir", gestures: [{ id: "tiroir", on: "Ouvrir le tiroir", off: "Fermer le tiroir" }] },
  { id: "detente", space: "hall", name: "Le coin détente", gestures: [{ id: "coussins", on: "Soulever les coussins", off: "Remettre les coussins" }] },
];
export const propsIn = (space: SpaceId) => PROPS.filter((p) => p.space === space);
