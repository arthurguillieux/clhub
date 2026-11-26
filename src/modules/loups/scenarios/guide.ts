/**
 * « Le meneur guidé » (V1.4 §5): each text to read carries the gestures to make in the base at that
 * moment (« Lumière : allumer le hall », « Porte Β : utiliser la clé, ouvrir »). Those the console knows
 * how to do become a button; the others stay a box to tick. Pure, so the mapping is tested.
 */
import type { Action } from "./engine";
import { SPACES } from "./station";
import type { ScenarioDef, ScenarioParams } from "./types";

const norm = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** The console's action for a gesture written in a text, or null when it's for the meneur to do by hand. */
export function gestureAction(def: Pick<ScenarioDef, "media" | "doors" | "terminals">, params: Pick<ScenarioParams, "gaugeSeconds">, gesture: string): Action | null {
  const g = norm(gesture);
  const [head, ...rest] = gesture.split(":");
  const what = norm(rest.join(":"));
  const h = norm(head ?? "");
  const quoted = gesture.match(/«\s*([^«»]+?)\s*»/)?.[1];

  if (h === "ecran") return what.startsWith("accueil") ? { t: "screen", mode: "accueil" } : what.startsWith("plan") ? { t: "screen", mode: "plan" } : null;
  if (h === "son" || h === "ambiance") {
    const slot = def.media.find((m) => m.kind === "audio" && (norm(m.label) === what || what.startsWith(norm(m.label)) || norm(m.label).includes(what)));
    return slot ? { t: "sound", slot: slot.id } : null;
  }
  if (h === "alarme" || h === "alarme courte") {
    const slot = def.media.find((m) => norm(m.label) === "alarme");
    return slot ? { t: "sound", slot: slot.id } : null;
  }
  if (h === "lumiere") return what.startsWith("allumer") ? { t: "light", on: true } : what.startsWith("eteindre") || what.startsWith("couper") ? { t: "light", on: false } : null;
  if (h.startsWith("porte")) {
    const letter = (head ?? "").replace(/^Porte\s*/i, "").trim();
    const door = h === "porte du sas" ? def.doors.find((d) => d.id === "sas") : def.doors.find((d) => d.letter === letter);
    if (!door) return null;
    if (door.id === "beta" && letter === "Κ") return null; // the archives open with the wing
    return { t: "unlock", door: door.id };
  }
  if (h === "je suis dans") {
    const space = SPACES.find((s) => norm(s.name) === what || norm(s.id) === what || norm(s.name).startsWith(what));
    return space ? { t: "go", space: space.id } : null;
  }
  if (h.startsWith("terminal")) {
    const id = h.includes("accueil") ? "accueil" : h.includes("archives") ? "beta" : h.includes("laboratoire") ? "labo" : h.includes("securite") ? "securite" : null;
    return id && def.terminals.some((t) => t.id === id) ? { t: "terminal", id } : null;
  }
  if (h === "faille") return { t: "glitch" };
  if (h === "effet") return what.startsWith("blizzard") ? { t: "blizzard", on: true } : what.startsWith("aurore") ? { t: "aurora", on: true } : null;
  if (h === "jauge de carburant") return { t: "gauge", seconds: params.gaugeSeconds };
  if (g.startsWith("reveler le(s) mort") || g.startsWith("reveler les morts") || g.startsWith("reveler le mort")) return { t: "reveal" };
  if (h === "boitier de la panic room") return { t: "circuit", show: true };
  if (h === "chrono") {
    const min = Number(what.match(/(\d+)\s*min/)?.[1] ?? 0);
    return min ? { t: "timer", which: "main", cmd: "start", seconds: min * 60, label: "Chrono" } : null;
  }
  if (h.startsWith("enregistrer la salle")) return { t: "record" };
  if ((h.startsWith("palier") || h.startsWith("intrusion")) && quoted) return { t: "intrusion", text: quoted };
  return null;
}
