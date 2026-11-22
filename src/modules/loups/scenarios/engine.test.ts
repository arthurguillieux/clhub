import { describe, expect, it } from "vitest";
import { ANTARCTICA } from "./antarctica";
import { alive, contagionActive, dawnDeaths, missedClues, nightSteps, pack, proposals, recap, registry, replay, suggestedWinner, type Action, type Setup } from "./engine";
import { checkPassword } from "./index";

const NAMES = ["Ana", "Ben", "Cléo", "Dan", "Eli", "Fanny", "Gus", "Hugo", "Inès", "Jade"];
const setup = (more: Partial<Setup["params"]> = {}): Setup => ({
  players: NAMES.map((name, i) => ({ id: `p${i + 1}`, name })),
  params: { ...ANTARCTICA.defaults, ...more },
  events: ANTARCTICA.events,
  extraFaults: [],
});
const run = (actions: Action[], s = setup()) =>
  replay(
    ANTARCTICA,
    s,
    actions.map((action, i) => ({ action, at: i * 1000 })),
  );
const start: Action[] = [{ t: "start" }, { t: "arrive" }, { t: "patientZero", player: "p1" }];
const night = (infect: string | null, victim: string | null, chosen = "blizzard"): Action[] => [
  { t: "night" },
  ...(infect ? [{ t: "infect", player: infect } as Action] : []),
  { t: "victim", player: victim },
  { t: "propose", events: ["blizzard", "aurore", "generateurs"] },
  { t: "deadChoose", event: chosen },
  { t: "dawn" },
];

describe("the evening's course", () => {
  it("goes from the welcome screen to the bus, the arrival, and the first night only once patient zero is known", () => {
    const s = run([{ t: "start" }, { t: "arrive" }, { t: "night" }]);
    expect(s.phase).toBe("arrival");
    expect(run([...start, { t: "night" }])).toMatchObject({ phase: "night", round: 1, loop: 1 });
  });

  it("kills the victim at dawn, contaminates, and names the day's event", () => {
    const s = run([...start, ...night("p2", "p3")]);
    expect(s.phase).toBe("day");
    expect(s.players.find((p) => p.id === "p3")?.status).toBe("dead");
    expect(s.players.find((p) => p.id === "p2")).toMatchObject({ infected: true, infectedAt: "Boucle 1 · Nuit 1", infectedBy: "Ana" });
    expect(s.event).toBe("blizzard");
    expect(s.blizzard).toBe(true);
    expect(s.announced).toEqual(["p3"]);
    expect(s.log.at(-2)?.text).toBe("Contamination : Ben. Victime : Cléo. Les morts choisissent : Blizzard (contre Aurore australe, Générateurs).");
  });

  it("saves whoever is in the panic room, and the life syringe's patient", () => {
    const repaired: Action[] = [{ t: "switch", index: 0, up: true }, { t: "switch", index: 2, up: true }, { t: "switch", index: 3, up: true }, { t: "power" }];
    const s = run([...start, ...repaired, { t: "night" }, { t: "panic", player: "p3" }, { t: "victim", player: "p3" }]);
    expect(s.panicReady).toBe(true);
    expect(dawnDeaths(s)).toEqual([]);
    const syringe = run([...start, { t: "giveItem", item: "vie", player: "p4" }, { t: "night" }, { t: "victim", player: "p5" }, { t: "useItem", item: "vie", target: "p5" }]);
    expect(dawnDeaths(syringe)).toEqual([]);
    expect(syringe.items.vie?.used).toBe(true);
  });

  it("refuses a wrong circuit", () => {
    expect(run([...start, { t: "switch", index: 1, up: true }, { t: "power" }]).panicReady).toBe(false);
  });
});

describe("contagion", () => {
  it("lasts the first N nights, under the pack's ceiling", () => {
    const params = setup().params;
    let s = run([...start, ...night("p2", "p9"), { t: "exile", player: null }, ...night("p3", "p10")]);
    expect(pack(s).map((p) => p.name)).toEqual(["Ana", "Ben", "Cléo"]);
    expect(contagionActive({ ...s, round: 3 }, params)).toBe(true);
    expect(contagionActive({ ...s, round: 4 }, params)).toBe(false);
    s = run([...start, ...night("p2", null), ...night("p3", null), ...night("p4", null)], setup({ contagionNights: 5 }));
    expect(pack(s)).toHaveLength(4);
    expect(contagionActive({ ...s, round: 4 }, { ...params, contagionNights: 5 })).toBe(false); // the ceiling of 4
    expect(nightSteps({ ...s, round: 4 }, { ...params, contagionNights: 5 })).not.toContain("infect");
  });
});

describe("the end of a loop", () => {
  it("suggests the village once no one is contaminated, the pack once it's as many as the healthy", () => {
    expect(suggestedWinner(run([...start, ...night(null, "p3"), { t: "exile", player: "p1" }]))).toBe("village");
    const many = run([...start, ...night("p2", "p6"), { t: "exile", player: "p7" }, ...night("p3", "p8"), { t: "exile", player: "p9" }, ...night(null, "p10")]);
    expect(alive(many).length).toBe(5);
    expect(suggestedWinner(many)).toBe("meute");
  });

  it("reboots into the next loop: everyone back, rooms of the dead sealed with their names", () => {
    const s = run([...start, ...night("p2", "p3"), { t: "exile", player: "p1" }, { t: "endLoop", winner: "village" }, { t: "reboot" }]);
    expect(s).toMatchObject({ phase: "bus", loop: 2, patientZero: null, light: false });
    expect(s.sealed).toEqual({ 1: "Ana", 3: "Cléo" });
    expect(alive(s)).toHaveLength(10);
    expect(pack(s)).toHaveLength(0);
    expect(run([...start, ...night(null, "p3"), { t: "endLoop", winner: "meute" }, { t: "reboot" }], setup({ hallLitLoop2: true })).light).toBe(true);
  });

  it("ends badly after the last loop, and lists the faults the players missed", () => {
    const actions: Action[] = [...start, { t: "fault", id: "hallmic" }, ...night(null, "p3"), { t: "fault", id: "glitch" }, { t: "endLoop", winner: "meute" }, { t: "reboot" }, { t: "arrive" }, { t: "patientZero", player: "p2" }, ...night(null, "p4"), { t: "endLoop", winner: "meute" }, { t: "reboot" }];
    const s = run(actions);
    expect(s.phase).toBe("bad");
    expect(missedClues(ANTARCTICA, setup(), s)).toEqual([
      { at: "Boucle 1 · Arrivée", text: "Un fichier audio de la salle, daté d'il y a 47 minutes" },
      { at: "Boucle 1 · Jour 1", text: "L'en-tête affiche « SIMULATION ALPHA » et la date du jour" },
    ]);
  });

  it("ends well whenever the village votes against the meneur", () => {
    expect(run([...start, ...night(null, "p3"), { t: "goodEnd" }]).phase).toBe("good");
  });
});

describe("the journal", () => {
  it("is the truth: undoing is replaying one action less", () => {
    const actions: Action[] = [...start, ...night("p2", "p3")];
    expect(run(actions.slice(0, -1)).phase).toBe("night");
    expect(run(actions.slice(0, -1)).players.find((p) => p.id === "p3")?.status).toBe("alive");
  });

  it("a fault on a terminal opens it and plays its file", () => {
    expect(run([...start, { t: "fault", id: "hallmic" }])).toMatchObject({ terminal: "beta", playing: "hallmic" });
  });

  it("proposes as many events as set, and the recap says who contaminated whom", () => {
    const s = run([...start, ...night("p2", "p3")]);
    expect(proposals(s, setup())).toHaveLength(3);
    expect(recap(s).find((r) => r.name === "Ben")).toMatchObject({ infected: true, by: "Ana" });
  });
});

describe("the password", () => {
  it("opens Antarctica with APE26, whatever the case and the spaces", () => {
    expect(checkPassword(ANTARCTICA, " ape26 ")).toBe(true);
    expect(checkPassword(ANTARCTICA, "APE27")).toBe(false);
  });
});

describe("V1.1: the surveillance tapes", () => {
  it("come up every night while their holder lives, and show the side as the night began", () => {
    const given: Action[] = [...start, { t: "giveItem", item: "bandes", player: "p5" }];
    let s = run([...given, { t: "night" }]);
    expect(nightSteps(s, setup().params)).toEqual(["tapes", "infect", "victim", "dead"]);
    s = run([...given, { t: "night" }, { t: "infect", player: "p2" }, { t: "tapes", target: "p2" }]);
    expect(s.tonight.tapes).toEqual({ target: "p2", infected: false }); // contaminated tonight, but only at dawn
    expect(s.log.at(-1)?.text).toBe("Bandes : Eli regarde Ben (sain).");
    expect(run([...given, { t: "night" }, { t: "tapes", target: "p1" }]).tonight.tapes?.infected).toBe(true);
    const dead = run([...given, ...night(null, "p5"), { t: "exile", player: null }, { t: "night" }]);
    expect(nightSteps(dead, setup().params)).not.toContain("tapes");
    const passed = run([...given, ...night(null, "p5"), { t: "giveItem", item: "bandes", player: "p6" }, { t: "exile", player: null }, { t: "night" }]);
    expect(nightSteps(passed, setup().params)).toContain("tapes");
    expect(run([...given, ...night(null, "p3"), { t: "exile", player: "p7" }, { t: "endLoop", winner: "meute" }, { t: "reboot" }]).items.bandes?.holder).toBeNull();
  });
});

describe("V1.1: the life syringe follows the witch's rule", () => {
  const given: Action[] = [...start, { t: "giveItem", item: "vie", player: "p4" }, { t: "night" }, { t: "infect", player: "p5" }, { t: "victim", player: "p5" }];
  it("saves tonight's victim only, and the contamination stays", () => {
    expect(run([...given, { t: "useItem", item: "vie", target: "p6" }]).items.vie?.used).toBe(false);
    const saved = run([...given, { t: "useItem", item: "vie", target: "p5" }, { t: "dawn" }]);
    expect(saved.players.find((p) => p.id === "p5")).toMatchObject({ status: "alive", infected: true });
  });

  it("has no victim to save when the victim sleeps in the panic room", () => {
    const repaired: Action[] = [{ t: "switch", index: 0, up: true }, { t: "switch", index: 2, up: true }, { t: "switch", index: 3, up: true }, { t: "power" }];
    const s = run([...start, ...repaired, { t: "giveItem", item: "vie", player: "p4" }, { t: "night" }, { t: "panic", player: "p5" }, { t: "victim", player: "p5" }, { t: "useItem", item: "vie", target: "p5" }]);
    expect(s.items.vie?.used).toBe(false);
  });
});

describe("V1.1: SUJETS.DAT", () => {
  it("lists every subject with this loop's status and the loops before, never a side", () => {
    const s = run([...start, ...night("p2", "p3"), { t: "exile", player: "p4" }, { t: "endLoop", winner: "meute" }, { t: "reboot" }, { t: "arrive" }, { t: "patientZero", player: "p5" }, ...night(null, "p6")]);
    const lines = registry(s);
    expect(lines[0]).toBe("PROTOCOLE ALPHA — REGISTRE DES SUJETS — SESSION 02");
    expect(lines.find((l) => l.includes("CLÉO"))).toMatch(/STATUT : ACTIF$/);
    expect(lines.join("\n")).toMatch(/SESSION 01 : DÉCÉDÉ \(SESSION 01, NUIT 1\)/);
    expect(lines.join("\n")).toMatch(/SESSION 01 : EXCLU  \(SESSION 01, JOUR 1\)/);
    expect(lines.find((l) => l.includes("FANNY"))).toMatch(/DÉCÉDÉ \(SESSION 02, NUIT 1\)/);
    expect(lines.join("\n")).not.toMatch(/CONTAMIN|SAIN/);
  });
});
