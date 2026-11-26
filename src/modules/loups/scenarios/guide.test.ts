import { describe, expect, it } from "vitest";
import { ANTARCTICA } from "./antarctica";
import { gestureAction } from "./guide";
import { DEFAULT_TEXTS } from "./texts";

const g = (text: string) => gestureAction(ANTARCTICA, ANTARCTICA.defaults, text);

describe("le meneur guidé: the texts' gestures", () => {
  it("become the console's actions when it knows how", () => {
    expect(g("Écran : accueil de la station")).toEqual({ t: "screen", mode: "accueil" });
    expect(g("Son : moteur du bus")).toEqual({ t: "sound", slot: "son-bus-moteur" });
    expect(g("Ambiance : vent")).toEqual({ t: "sound", slot: "son-vent" });
    expect(g("Lumière : allumer le hall")).toEqual({ t: "light", on: true });
    expect(g("Porte Β : utiliser la clé, ouvrir")).toEqual({ t: "unlock", door: "beta" });
    expect(g("Porte du sas : ouvrir")).toEqual({ t: "unlock", door: "sas" });
    expect(g("Porte Α : tenter (sans annoncer)")).toEqual({ t: "unlock", door: "alpha" });
    expect(g("Je suis dans : hall")).toEqual({ t: "go", space: "hall" });
    expect(g("Terminal des archives : afficher (mot de passe)")).toEqual({ t: "terminal", id: "beta" });
    expect(g("Révéler le(s) mort(s) de la nuit")).toEqual({ t: "reveal" });
    expect(g("Chrono : 6 min")).toEqual({ t: "timer", which: "main", cmd: "start", seconds: 360, label: "Chrono" });
    expect(g("Palier 2 : intrusion « L _ _ _ A »")).toEqual({ t: "intrusion", text: "L _ _ _ A" });
    expect(g("Jauge de carburant : lancer")).toEqual({ t: "gauge", seconds: 600 });
  });

  it("stay a box to tick otherwise", () => {
    expect(g("Lumière de salle allumée")).toBeNull();
    expect(g("Cachette : clavier → la clé")).toBeNull();
    expect(g("Noter le porteur du pistolet")).toBeNull();
    expect(g("Porte Κ : ouvrir")).toBeNull();
  });

  it("cover most of the file's gestures", () => {
    const all = DEFAULT_TEXTS.textes.flatMap((t) => t.gestes ?? []);
    const done = all.filter((x) => g(x));
    expect(all.length).toBeGreaterThan(100);
    expect(done.length / all.length).toBeGreaterThan(0.4);
  });
});
