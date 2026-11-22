/**
 * What the room's screen may know of an evening: never a side, never a night secret, never a secret
 * item (nor that it was found), never the chief's resistance. Pure, so it's tested on any journal.
 */
import type { Action, Setup, State } from "./engine";
import type { ScenarioDef } from "./types";

/** Gestures of the night and of the meneur alone: they never leave the console, not even as data. */
export const NIGHT_SECRETS = new Set<Action["t"]>(["patientZero", "infect", "victim", "tapes", "useItem", "giveItem", "setInfected", "panic", "propose", "deadChoose", "skip"]);

export type PublicState = Omit<State, "players" | "tonight" | "patientZero" | "log" | "items" | "chiefResisted" | "lastExile" | "trusted"> & {
  lastExiled: string | null;
  lastEvent: string | null;
  /** The pistol's holder: handed out in front of everyone. */
  pistol: string | null;
};

export function publicState(def: Pick<ScenarioDef, "items">, setup: Pick<Setup, "events">, full: State): PublicState {
  const { players, tonight, patientZero, log, items, chiefResisted, lastExile, trusted, ...rest } = full;
  void [players, tonight, patientZero, chiefResisted, lastExile, trusted];
  const secret = new Set(def.items.filter((i) => i.family === "secret").map((i) => i.id).concat("seringues"));
  const exiled = [...log].reverse().find((l) => l.text.startsWith("Exil :") && !l.text.includes("personne"));
  return {
    ...rest,
    found: rest.found.filter((id) => !secret.has(id)),
    foundToday: rest.foundToday.filter((id) => !secret.has(id)),
    pistol: items.pistolet && !items.pistolet.used ? items.pistolet.holder : null,
    lastExiled: exiled ? exiled.text.replace(/^Exil : /, "").replace(/ \(.*$/, "") : null,
    lastEvent: setup.events.find((e) => e.id === full.event)?.name ?? null,
  };
}

/** The last gestures, for the effects played once, without the night's. */
export function publicRecent<T extends { action: Action }>(rows: T[]): T[] {
  return rows.slice(-12).filter((r) => !NIGHT_SECRETS.has(r.action.t));
}
