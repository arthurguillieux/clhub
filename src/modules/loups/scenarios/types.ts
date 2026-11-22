/**
 * What a « scénario spécial » is made of: a base (rooms, doors, terminals), media the projection
 * computer brings, day events, faults, texts. The engine (engine.ts) plays any of them; Antarctica
 * is the first.
 */

export interface TerminalFile {
  id: string;
  /** As listed on the terminal, « LOG_871220.VID ». */
  name: string;
  meta: string;
  /** text: words typed on the tube (from the preparation); registry: the subjects, built from the players. */
  kind: "video" | "audio" | "recording" | "image" | "text" | "registry";
  /** The media slot that holds the file (projection computer), when it has one. */
  media?: string;
  date: string;
  time: string;
  subs: string[];
  /** Hidden until this fault is triggered. */
  fault?: string;
}

export interface Terminal {
  id: string;
  label: string;
  hint: string;
  /** The room that must be revealed for the terminal to be reached. */
  room: string;
  /** Where the camera zooms, in plan units (1600 × 820). */
  hot: { x: number; y: number };
  boot: string;
  files: TerminalFile[];
}

export interface Door {
  id: string;
  letter: string;
  label: string;
  hint: string;
  /** Never opens: « Tenter » only. */
  locked?: boolean;
}

export interface MediaSlot {
  id: string;
  label: string;
  kind: "video" | "audio" | "image";
  /** The file name the projection computer looks for in its folder. */
  file: string;
  /** A sound of the pupitre: its category, and whether it loops (ambiances). */
  category?: "Bus" | "Nuit" | "Jour" | "Ambiances" | "Scénario";
  /** Needed for the evening (a missing one is flagged on the projection's list); sounds are optional. */
  required?: boolean;
  loop?: boolean;
}

export interface DayEvent {
  id: string;
  name: string;
  rule: string;
  effect?: "blizzard" | "aurora" | "gauge";
}

export interface Fault {
  id: string;
  title: string;
  /** The loops it belongs to (suggested order follows the list). */
  loops: number[];
  kind: "terminalFile" | "glitch" | "tracker" | "image" | "text";
  /** terminalFile: the terminal and file it reveals and plays. */
  terminal?: string;
  file?: string;
  /** image: the media slot shown full screen. text: the words shown. */
  media?: string;
  text?: string;
  /** For the bad ending: what the players missed, in one line. */
  missed: string;
}

export interface ScenarioParams {
  loops: number;
  contagionNights: number;
  packMax: number;
  /** Switches A to D: up (true) or down. */
  circuit: [boolean, boolean, boolean, boolean];
  eventsProposed: number;
  hallLitLoop2: boolean;
  /** How long the generators' gauge lasts, in seconds. */
  gaugeSeconds: number;
}

export interface Item {
  id: string;
  name: string;
  effect: "life" | "death" | "pistol" | "key" | "tapes";
}

export interface ScenarioDef {
  id: string;
  title: string;
  subtitle: string;
  /** SHA-256 of the scenario's password, in hex: the password itself is never in the code. */
  passwordSha256: string;
  header: string;
  /** The in-world date of the HUD, and the real one shown by a fault. */
  worldDate: string;
  realDate: string;
  defaults: ScenarioParams;
  doors: Door[];
  terminals: Terminal[];
  items: Item[];
  media: MediaSlot[];
  events: DayEvent[];
  faults: Fault[];
  texts: { goodEnd: string; badEnd: string; reboot: string; welcome: string };
}

/** What the browser gets of a scenario: everything but its password's hash. */
export type PublicScenario = Omit<ScenarioDef, "passwordSha256">;
