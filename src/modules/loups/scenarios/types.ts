/**
 * What a « scénario spécial » is made of: a base (zones, doors, terminals), what the village can do
 * each day, its powers, the media the projection computer brings, day events, faults, texts. The
 * engine (engine.ts) plays any of them; Antarctica is the first.
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
  /** The zone that must be open for the terminal to be reached ("hall": lit). */
  room: string;
  /** Where the camera zooms, in plan units (1600 × 820). */
  hot: { x: number; y: number };
  boot: string;
  files: TerminalFile[];
}

/** What the village holds once found: not a player's item, a flag of the whole team. */
export type Flag = "key" | "badge2" | "badge3" | "code" | "power";

export interface Door {
  id: string;
  letter: string;
  label: string;
  hint: string;
  /** What opens it; none: free. */
  requires?: Flag;
  /** Never opens: « Tenter » only. */
  locked?: boolean;
}

/** One thing the village does with its day: a door to go through, and what lies behind it. */
export interface DayAction {
  id: string;
  label: string;
  /** Under the door, on the projection. */
  sentence: string;
  /** The door it goes through ("hall": the hall must be lit). */
  zone: string;
  requires?: Flag;
  /** Flags found there. */
  gives?: Flag[];
  /** Items found there (the meneur then names who carries them). */
  finds?: string[];
  /** The text to read on entering (« Textes à lire »). */
  text?: string;
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
  /** blizzard: snow; dark: a lamp's beam only; gauge: the fuel; quarantine: two protected players; parity: even rooms; confinement: the base cut in two. */
  effect?: "blizzard" | "aurora" | "gauge" | "dark" | "quarantine" | "parity" | "confinement";
  /** The text read when it's played (« Textes à lire »). */
  text?: string;
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
  /** The zone that must be open before it can go off. */
  zone?: string;
  /** For the bad ending: what the players missed, in one line. */
  missed: string;
}

export interface ScenarioParams {
  loops: number;
  contagionNights: number;
  packMax: number;
  /** Switches A to D: up (true) or down. */
  circuit: [boolean, boolean, boolean, boolean];
  /** Events the dead choose between (two since V1.2). */
  eventsProposed: number;
  hallLitLoop2: boolean;
  /** How long the generators' gauge lasts, in seconds. */
  gaugeSeconds: number;
  /** The vote by moving: a door, the dead's moment, the election (seconds). */
  voteDoorSeconds?: number;
  voteDeadSeconds?: number;
  voteChiefSeconds?: number;
  confinementSeconds?: number;
}

/** public: handed out in front of everyone; room: a power of a room, once per loop; secret: a hidden holder. */
export interface Item {
  id: string;
  name: string;
  family: "public" | "room" | "secret";
  effect: "life" | "death" | "pistol" | "tapes" | "test" | "radio";
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
  /** The outside temperature shown, around which it wavers. */
  temperature: number;
  defaults: ScenarioParams;
  doors: Door[];
  dayActions: DayAction[];
  /** The two doors suggested each day, by « loop-day »; the rest follows `dayActions`' order. */
  dayPlan: Record<string, string[]>;
  terminals: Terminal[];
  items: Item[];
  media: MediaSlot[];
  events: DayEvent[];
  faults: Fault[];
  texts: { goodEnd: string; badEnd: string; reboot: string; welcome: string };
}

/** What the browser gets of a scenario: everything but its password's hash. */
export type PublicScenario = Omit<ScenarioDef, "passwordSha256">;
