import { createHash } from "node:crypto";
import { ANTARCTICA } from "./antarctica";
import type { ScenarioDef } from "./types";

/** The scenarios of Loups-garous › Scénarios spéciaux. A new one is a definition added here. */
export const SCENARIOS: ScenarioDef[] = [ANTARCTICA];

export const scenarioOf = (id: string) => SCENARIOS.find((s) => s.id === id) ?? null;

/** Each scenario opens with its own password, compared trimmed and in upper case. */
export function checkPassword(def: ScenarioDef, password: string): boolean {
  return createHash("sha256").update(password.trim().toUpperCase()).digest("hex") === def.passwordSha256;
}
