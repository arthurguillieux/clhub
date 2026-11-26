import { describe, expect, it } from "vitest";
import { ANTARCTICA } from "./antarctica";
import { replay, type Action, type Setup } from "./engine";
import { DEFAULT_TEXTS, blocks, faultVariant, fromPhrase, importSummary, inline, parseTextFile, pickVariant, resolveTexts, suggestTexts, textVars } from "./texts";

const NAMES = ["Camille", "Hugo", "Léa", "Lucas", "Manon", "Thomas", "Chloé", "Nicolas", "Emma", "Maxime"];
const setup: Setup = { players: NAMES.map((name, i) => ({ id: `p${i + 1}`, name })), params: ANTARCTICA.defaults, events: ANTARCTICA.events, extraFaults: [] };
const run = (actions: Action[]) =>
  replay(
    ANTARCTICA,
    setup,
    actions.map((action, i) => ({ action, at: i * 1000 })),
  );
const at = (actions: Action[]) => {
  const s = run(actions);
  const { ids, at: i } = suggestTexts(ANTARCTICA, setup, s);
  return { s, ids, first: ids[i] };
};
/** Every {variable} of the texts proposed, replaced or not. */
const unresolved = (actions: Action[]) => {
  const { s, ids } = at(actions);
  return ids.flatMap((id) => {
    const t = DEFAULT_TEXTS.textes.find((x) => x.id === id)!;
    return blocks(t.texte).flatMap((b) => inline(b.text, textVars(s, id)).filter((p) => p.kind === "unknown").map((p) => `${id} ${p.text}`));
  });
};

// The evening of the mapping table, step by step.
const arrival: Action[] = [{ t: "start" }, { t: "arrive" }, { t: "light", on: true }, { t: "door", door: "dortoir", open: true }];
const elected: Action[] = [...arrival, { t: "vote", kind: "chief", options: ["p9", "p10"] }, { t: "voteResult", choice: "p10" }, { t: "patientZero", player: "p1" }, { t: "giveItem", item: "seringues", player: "p4" }];
const night1: Action[] = [...elected, { t: "night" }];
const day1: Action[] = [...night1, { t: "infect", player: "p2" }, { t: "victim", player: "p3" }, { t: "skip", step: "items" }, { t: "dawn" }];
const door1: Action[] = [...day1, { t: "vote", kind: "door", options: ["accueil", "sas"] }, { t: "voteResult", choice: "sas" }, { t: "gesture", key: "coffre.fouiller", on: true }, { t: "giveItem", item: "pistolet", player: "p5" }];
const shot: Action[] = [...door1, { t: "shoot", target: "p6" }];
const exile1: Action[] = [...door1, { t: "exile", player: "p10" }];
const night2: Action[] = [...exile1, { t: "night" }];
const dead: Action[] = [...night2, { t: "skip", step: "infect" }, { t: "victim", player: "p7" }, { t: "skip", step: "items" }];
const day2: Action[] = [...dead, { t: "vote", kind: "dead", options: ["blizzard", "delestage"] }, { t: "voteResult", choice: "delestage" }, { t: "dawn" }];
const archives: Action[] = [...day2, { t: "dayAction", id: "accueil" }, { t: "exile", player: null }, { t: "night" }, { t: "victim", player: null }, { t: "dawn" }, { t: "dayAction", id: "archives-fouille" }, { t: "gesture", key: "carton.fouiller", on: true }];

describe("Textes à lire: the mapping table, row by row", () => {
  it("Avant le jeu, prologue", () => {
    expect(at([]).ids).toEqual(["OUV-01"]);
    expect(at([{ t: "start" }]).ids).toEqual(["PRO-01", "PRO-02", "PRO-03", "PRO-04"]);
  });

  it("Arrivée, boucle 1: ARR-06 opens once the chief is elected", () => {
    expect(at(arrival)).toMatchObject({ ids: ["ARR-01", "ARR-02", "ARR-03", "ARR-04", "ARR-05", "ARR-06", "ARR-07"], first: "ARR-01" });
    expect(at(elected).first).toBe("ARR-06");
    expect(unresolved(elected)).toEqual([]);
  });

  it("Nuit 1: NUIT-01, NUIT-13 from « La bête a besoin d'une meute », NUIT-15, NUIT-16 with a holder, NUIT-18", () => {
    expect(at(night1).ids).toEqual(["NUIT-01", "NUIT-13", "NUIT-15", "NUIT-16", "NUIT-18"]);
    const nuit13 = DEFAULT_TEXTS.textes.find((t) => t.id === "NUIT-13")!.texte;
    expect(fromPhrase(nuit13, "La bête a besoin d'une meute")).toMatch(/^La bête a besoin d'une meute/);
  });

  it("Réveil: JOUR-01 for one death, JOUR-03 for none; {victime} replaced", () => {
    expect(at(day1).first).toBe("JOUR-01");
    expect(textVars(run(day1)).victime).toBe("Léa");
    expect(at([...night1, { t: "victim", player: null }, { t: "dawn" }]).first).toBe("JOUR-03");
  });

  it("Choix de la porte, pièce, objet trouvé: JOUR-05, SALLE-02, OBJ-02", () => {
    const { ids, first } = at(door1);
    expect(ids).toEqual(expect.arrayContaining(["JOUR-05", "SALLE-02", "OBJ-02"]));
    expect(first).toBe("SALLE-02");
    // Only the exile's name is still unknown: it's entered after the vote, JOUR-12 is read then.
    expect(new Set(unresolved(door1))).toEqual(new Set(["JOUR-12 {exilé}"]));
    expect(unresolved(exile1)).toEqual([]);
  });

  it("Tir du pistolet: JOUR-15, the variant of the target's side, {tireur} and {cible}", () => {
    const { s, first } = at(shot);
    expect(first).toBe("JOUR-15");
    expect(textVars(s)).toMatchObject({ tireur: "Manon", cible: "Thomas" });
    const labels = blocks(DEFAULT_TEXTS.textes.find((t) => t.id === "JOUR-15")!.texte).filter((b) => b.kind === "variant").map((b) => b.label!);
    expect(pickVariant("JOUR-15", labels, { night: 1, targetInfected: s.lastShot?.infected })).toMatch(/saine/);
  });

  it("Débat et exil: JOUR-13 when the chief was healthy, JOUR-14, then JOUR-16; {exilé}", () => {
    const { s, ids, first } = at(exile1);
    expect(ids.slice(-3)).toEqual(["JOUR-13", "JOUR-14", "JOUR-16"]);
    expect(first).toBe("JOUR-13");
    expect(textVars(s).exilé).toBe("Maxime");
  });

  it("Nuits suivantes: NUIT-02, the variant of the night, NUIT-17 when someone else is dead", () => {
    const { ids } = at(dead);
    expect(ids).toEqual(["NUIT-02", "NUIT-13", "NUIT-15", "NUIT-17", "NUIT-18"]); // the healthy chief exiled locked the syringes
    const labels = blocks(DEFAULT_TEXTS.textes.find((t) => t.id === "NUIT-02")!.texte).filter((b) => b.kind === "variant").map((b) => b.label!);
    expect(pickVariant("NUIT-02", labels, { night: 2 })).toBe("Variante a");
    expect(pickVariant("NUIT-02", labels, { night: 3 })).toBe("Variante b");
    expect(at(dead).first).toBe("NUIT-17");
  });

  it("Événement: JOUR-04 then the EVT of the dead's choice", () => {
    expect(at(day2).ids.slice(0, 3)).toEqual(["JOUR-01", "JOUR-04", "EVT-02"]);
  });

  it("Pièce ouverte: SALLE-03 on the first entry into the archives, then SALLE-05; OBJ-01 for the tapes", () => {
    const { ids, first } = at(archives);
    expect(ids).toEqual(expect.arrayContaining(["SALLE-03", "SALLE-05", "OBJ-01"]));
    expect(first).toBe("SALLE-03");
  });

  it("Fin de la boucle 1, début de la boucle 2, jour 4, fins", () => {
    const end: Action[] = [...day1, { t: "endLoop", winner: "meute" }];
    expect(at(end).ids).toEqual(["FIN1-M", "REBOOT-01"]);
    expect(at([...end, { t: "reboot" }]).ids).toEqual(["PRO-05"]);
    const loop2: Action[] = [...end, { t: "reboot" }, { t: "arrive" }];
    expect(at(loop2).ids).toEqual(["ARR-10", "ARR-11", "ARR-12", "MARGA-02"]);
    expect(textVars(run(loop2))).toMatchObject({ chef_b1: "Maxime", morts_b1: "Léa" });
    const day4 = run([...loop2, { t: "patientZero", player: "p2" }, { t: "jump", phase: "day" }]);
    expect(suggestTexts(ANTARCTICA, setup, { ...day4, round: 4 }).ids).toContain("B2-J4");
    expect(at([...day1, { t: "goodEnd" }]).ids).toEqual(["FIN-BONNE", "FIN-REEL"]);
    expect(at([...day1, { t: "badEnd" }]).ids).toEqual(["FIN-MAUVAISE", "FIN-REEL"]);
  });

  it("every id of the table exists in the file", () => {
    const table = "OUV-01 PRO-01 PRO-02 PRO-03 PRO-04 ARR-01 ARR-02 ARR-03 ARR-04 ARR-05 ARR-06 ARR-07 NUIT-01 NUIT-02 NUIT-03 NUIT-10 NUIT-11 NUIT-12 NUIT-13 NUIT-14 NUIT-15 NUIT-16 NUIT-17 NUIT-18 JOUR-01 JOUR-02 JOUR-03 JOUR-04 EVT-01 EVT-02 EVT-03 EVT-04 EVT-05 EVT-06 JOUR-05 JOUR-06 SALLE-01 SALLE-02 SALLE-03 SALLE-04 SALLE-05 SALLE-06 SALLE-07 SALLE-08 SALLE-09 SALLE-10 OBJ-01 OBJ-02 OBJ-03 JOUR-10 JOUR-11 JOUR-12 JOUR-13 JOUR-14 JOUR-15 JOUR-16 FIN1-V FIN1-M REBOOT-01 PRO-05 ARR-10 ARR-11 ARR-12 B2-J4 FIN-BONNE FIN-MAUVAISE FIN-REEL MARGA-01 MARGA-02 FAILLE-01".split(" ");
    const ids = new Set(DEFAULT_TEXTS.textes.map((t) => t.id));
    expect(table.filter((id) => !ids.has(id))).toEqual([]);
    const fromScenario = [...ANTARCTICA.dayActions.map((a) => a.text), ...ANTARCTICA.events.map((e) => e.text)].filter(Boolean) as string[];
    expect(fromScenario.filter((id) => !ids.has(id))).toEqual([]);
  });
});

describe("Textes à lire: the file", () => {
  it("cuts a text into what's read, the stage directions and the variants", () => {
    const b = blocks("💡 Noir.\n\nLisez ceci, {victime}.\n\n*Pause.*\n\n*Variante a :* Une nuit de plus.");
    expect(b.map((x) => x.kind)).toEqual(["stage", "read", "stage", "variant"]);
    expect(b[3]).toMatchObject({ label: "Variante a", text: "Une nuit de plus." });
    expect(inline("Lisez ceci, {victime} et [un vivant].", { victime: "Léa" }).map((p) => p.kind)).toEqual(["plain", "var", "plain", "choice", "plain"]);
    expect(inline("{chef} parle.", { chef: null })[0]).toEqual({ text: "{chef}", kind: "unknown" });
  });

  it("imports a new file with a summary, keeps the hand edits on top, refuses a broken one", () => {
    const next = { textes: [{ id: "OUV-01", partie: "", titre: "Accueil", quand: "", texte: "Bonsoir." }, { id: "NEW-01", partie: "", titre: "", quand: "", texte: "Neuf." }] };
    const parsed = parseTextFile(JSON.stringify(next));
    expect(parsed.ok).toBe(true);
    const summary = importSummary(DEFAULT_TEXTS.textes, next.textes);
    expect(summary.added).toEqual(["NEW-01"]);
    expect(summary.changed).toEqual(["OUV-01"]);
    expect(summary.removed).toHaveLength(DEFAULT_TEXTS.textes.length - 1);
    expect(resolveTexts(next, { "NEW-01": "Retouché." }).find((t) => t.id === "NEW-01")?.texte).toBe("Retouché.");
    expect(parseTextFile("{").ok).toBe(false);
    expect(parseTextFile(JSON.stringify({ textes: [{ id: "A", texte: "" }, { id: "A", texte: "" }] })).ok).toBe(false);
  });
});

describe("V1.3: the rules coded but never checked", () => {
  it("JOUR-02: two deaths at dawn (the pack's victim and the death syringe), {victime} and {victime2} replaced", () => {
    const two: Action[] = [...elected, { t: "night" }, { t: "victim", player: "p3" }, { t: "useItem", item: "mort", target: "p5" }, { t: "dawn" }];
    const { s, first } = at(two);
    expect(first).toBe("JOUR-02");
    expect(textVars(s)).toMatchObject({ victime: "Léa", victime2: "Manon" });
    expect(unresolved(two).filter((x) => x.startsWith("JOUR-02"))).toEqual([]);
  });

  it("JOUR-06: a single door possible, the search proposed", () => {
    const one: Action[] = [...day1, { t: "dayAction", id: "sas" }, { t: "exile", player: null }, { t: "night" }, { t: "victim", player: null }, { t: "dawn" }];
    const { ids } = at(one);
    expect(ids).toContain("JOUR-06");
    expect(ids).not.toContain("JOUR-05");
  });

  it("SALLE-10: the text comes once Alpha has refused", () => {
    expect(at(day1).ids).not.toContain("SALLE-10");
    expect(at([...day1, { t: "door", door: "alpha", open: true }]).ids).toContain("SALLE-10");
  });

  it("OBJ-03: a holder dies, and {victime} is that holder", () => {
    const gone: Action[] = [...elected, { t: "night" }, { t: "victim", player: "p4" }, { t: "dawn" }];
    const { s, ids } = at(gone);
    expect(ids).toContain("OBJ-03");
    expect(textVars(s, "OBJ-03").victime).toBe("Lucas");
    expect(at(day1).ids).not.toContain("OBJ-03");
  });
});

describe("V1.3: FAILLE-01", () => {
  const labels = blocks(DEFAULT_TEXTS.textes.find((t) => t.id === "FAILLE-01")!.texte)
    .filter((b) => b.kind === "variant")
    .map((b) => b.label!);
  const picks = (moments: string[]) => moments.map((_, i) => faultVariant(labels, moments.slice(0, i + 1).map((at) => ({ at }))));

  it("the file 0.3 keeps its six variants", () => {
    expect(DEFAULT_TEXTS.version).toBe("0.3");
    expect(labels).toEqual(["Variante a", "Variante b", "Variante c", "Variante d", "Variante e", "Variante f"]);
  });

  it("never the same twice, a to d first in loop 1, e and f first in loop 2, then all over again", () => {
    expect(picks(["Boucle 1 · Jour 1", "Boucle 1 · Jour 2", "Boucle 2 · Jour 1", "Boucle 2 · Jour 1", "Boucle 2 · Jour 2"])).toEqual(["Variante a", "Variante b", "Variante e", "Variante f", "Variante c"]);
    const seven = picks(Array.from({ length: 7 }, () => "Boucle 1 · Jour 1"));
    expect(new Set(seven.slice(0, 6)).size).toBe(6);
    expect(seven.slice(0, 4)).toEqual(["Variante a", "Variante b", "Variante c", "Variante d"]);
    expect(seven[6]).toBe("Variante a");
    expect(faultVariant(labels, [])).toBeNull();
  });
});
