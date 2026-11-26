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
}

export const STATION_W = 1000;
export const STATION_H = 760;

export const SPACES: Space[] = [
  { id: "hall", name: "HALL", x: 340, y: 420, w: 320, h: 220, zone: "hall" },
  { id: "sas", name: "SAS", x: 440, y: 640, w: 120, h: 90, zone: "sas" },
  { id: "dortoir", name: "DORTOIR", x: 40, y: 330, w: 300, h: 390, zone: "dortoir" },
  { id: "couloir", name: "AILE BÊTA", x: 450, y: 150, w: 100, h: 270, zone: "beta" },
  { id: "archives", name: "ARCHIVES", x: 230, y: 160, w: 220, h: 120, zone: "beta" },
  { id: "infirmerie", name: "INFIRMERIE", x: 330, y: 290, w: 120, h: 110, zone: "gamma" },
  { id: "generateurs", name: "GÉNÉRATEURS", x: 550, y: 160, w: 220, h: 120, zone: "generateurs" },
  { id: "securite", name: "PC SÉCU.", x: 550, y: 290, w: 120, h: 110, zone: "securite" },
  { id: "labo", name: "LABORATOIRE", x: 380, y: 30, w: 240, h: 120, zone: "labo" },
  { id: "alpha", name: "ALPHA", x: 660, y: 380, w: 300, h: 340, zone: "alpha" },
];

export interface StationDoor {
  /** The scenario's door id; `follows`: drawn open with that door (the archives open with the Bêta wing). */
  id: string;
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
  { id: "sas", letter: "Θ", x: 500, y: 640, v: false, side: "r", into: 1 },
  { id: "dortoir", letter: "Δ", x: 340, y: 530, v: true, side: "l", into: -1 },
  { id: "beta", letter: "Β", x: 500, y: 420, v: false, side: "r", into: -1 },
  { id: "alpha", letter: "Α", x: 660, y: 530, v: true, side: "r", into: 1 },
  { id: "archives", follows: "beta", letter: "Κ", x: 450, y: 220, v: true, side: "l", into: -1 },
  { id: "gamma", letter: "Γ", x: 450, y: 345, v: true, side: "l", into: -1 },
  { id: "generateurs", letter: "Ε", x: 550, y: 220, v: true, side: "r", into: 1 },
  { id: "securite", letter: "Ζ", x: 550, y: 345, v: true, side: "r", into: 1 },
  { id: "labo", letter: "Η", x: 500, y: 150, v: false, side: "r", into: -1 },
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
