import { describe, expect, it } from "vitest";
import { ANTARCTICA } from "./antarctica";
import { LOADING_MS, protocolOf, actionAvailable, alive, contagionActive, dawnDeaths, doorProposals, missedClues, nightSteps, pack, proposals, recap, registry, replay, suggestedWinner, timeLeft, type Action, type Setup } from "./engine";
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
  { t: "vote", kind: "dead", options: ["blizzard", "delestage"] },
  { t: "voteResult", choice: chosen },
  { t: "dawn" },
];

describe("the station before the game", () => {
  it("is piloted on its own, then loads the scenario, and the game starts in the base the scenario expects", () => {
    const base: Action[] = [{ t: "screen", mode: "plan" }, { t: "light", on: true }, { t: "door", door: "beta", open: true }, { t: "blizzard", on: true }, { t: "sound", slot: "son-vent" }];
    const piloted = run(base);
    expect(piloted).toMatchObject({ phase: "welcome", screen: "plan", light: true, blizzard: true, ambiances: ["son-vent"] });
    expect(piloted.doors.beta).toBe(true);
    expect(protocolOf(piloted, 0)).toBe("none");

    const loaded = replay(ANTARCTICA, setup(), [...base, { t: "load" } as Action].map((action, i) => ({ action, at: i * 1000 })));
    expect(protocolOf(loaded, 5000)).toBe("loading");
    expect(protocolOf(loaded, 5000 + LOADING_MS)).toBe("ready");
    expect(run([...base, { t: "load" }, { t: "unload" }]).loadingAt).toBeNull();

    const started = run([...base, { t: "room", player: "p1", room: 2 }, { t: "load" }, { t: "start" }]);
    expect(started).toMatchObject({ phase: "bus", light: false, blizzard: false, ambiances: [] });
    expect(started.doors.beta).toBe(false);
    expect(started.players.find((p) => p.id === "p1")?.room).toBe(2);
    expect(started.log.at(-1)?.text).toBe("Prologue du bus.");
    expect(protocolOf(started, 0)).toBe("running");
  });

  it("shows the plan to the room as soon as the base is touched, and goes back to the welcome image on demand", () => {
    expect(run([{ t: "sound", slot: "son-vent" }]).screen).toBe("accueil");
    expect(run([{ t: "door", door: "sas", open: true }]).screen).toBe("plan");
    expect(run([{ t: "light", on: true }, { t: "screen", mode: "accueil" }]).screen).toBe("accueil");
    // Once the scenario loads, the room watches it load: no switch to the plan.
    expect(run([{ t: "load" }, { t: "light", on: true }]).screen).toBe("accueil");
  });
});

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
    expect(s.log.at(-2)?.text).toBe("Contamination : Ben. Victime : Cléo. Les morts choisissent : Blizzard (contre Délestage).");
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
      { at: "Boucle 1 · Arrivée", text: "Un fichier audio de la salle, daté d'il y a quelques minutes" },
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
    expect(proposals(s, setup())).toHaveLength(2);
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
    const night2: Action[] = [...given, ...night(null, "p9"), { t: "exile", player: null }, { t: "night" }];
    expect(nightSteps(run([...given, { t: "night" }]), setup().params)).toEqual(["pz", "infect", "victim"]); // night 1: no tapes yet
    let s = run(night2);
    expect(nightSteps(s, setup().params)).toEqual(["tapes", "infect", "victim", "dead"]);
    s = run([...night2, { t: "infect", player: "p2" }, { t: "tapes", target: "p2" }]);
    expect(s.tonight.tapes).toEqual({ target: "p2", infected: false }); // contaminated tonight, but only at dawn
    expect(s.log.at(-1)?.text).toBe("Bandes : Eli regarde Ben (sain).");
    expect(run([...night2, { t: "tapes", target: "p1" }]).tonight.tapes?.infected).toBe(true);
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

describe("full control for the meneur", () => {
  it("a fault switched off never goes off, and comes back once switched on", () => {
    expect(run([...start, { t: "faultToggle", id: "glitch", on: false }, { t: "fault", id: "glitch" }]).faults).toEqual([]);
    expect(run([...start, { t: "faultToggle", id: null, on: false }, { t: "fault", id: "hallmic" }]).terminal).toBeNull();
    expect(run([...start, { t: "faultToggle", id: null, on: false }, { t: "faultToggle", id: "glitch", on: true }, { t: "fault", id: "glitch" }]).faults).toHaveLength(1);
  });

  it("Stop silences everything that plays, the base stays as it is", () => {
    const s = run([...start, { t: "light", on: true }, { t: "sound", slot: "son-vent" }, { t: "intrusion", text: "Bonsoir." }, { t: "blizzard", on: true }, { t: "gauge", seconds: 120 }, { t: "fault", id: "hallmic" }, { t: "stop" }]);
    expect(s).toMatchObject({ playing: null, ambiances: [], intrusion: null, blizzard: false, gauge: null, light: true });
  });

  it("the neutral screen closes what's open; jump goes anywhere; rooms swap", () => {
    expect(run([...start, { t: "terminal", id: "accueil" }, { t: "neutral", mode: "plan" }])).toMatchObject({ neutral: "plan", terminal: null });
    expect(run([...start, { t: "jump", phase: "day" }])).toMatchObject({ phase: "day", round: 1 });
    const s = run([...start, { t: "room", player: "p1", room: 3 }]);
    expect(s.players.find((p) => p.id === "p1")?.room).toBe(3);
    expect(s.players.find((p) => p.id === "p3")?.room).toBe(1);
  });

  it("a locked door opens only when forced", () => {
    expect(run([...start, { t: "door", door: "alpha", open: true }]).doors.alpha).toBe(false);
    expect(run([...start, { t: "door", door: "alpha", open: true, force: true }]).doors.alpha).toBe(true);
  });

  it("timers pause, resume and take a minute more or less", () => {
    const at = (actions: Action[], times: number[]) =>
      replay(
        ANTARCTICA,
        setup(),
        actions.map((action, i) => ({ action, at: times[i] ?? 0 })),
      );
    const timer: Action[] = [{ t: "timer", which: "main", cmd: "start", seconds: 60, label: "Débat" }, { t: "timer", which: "main", cmd: "pause" }];
    const paused = at(timer, [0, 20_000]);
    expect(timeLeft(paused.timer!, 99_000)).toBe(40);
    const resumed = at([...timer, { t: "timer", which: "main", cmd: "resume" }, { t: "timer", which: "main", cmd: "plus" }], [0, 20_000, 50_000, 50_000]);
    expect(timeLeft(resumed.timer!, 60_000)).toBe(90);
    expect(at([...timer, { t: "timer", which: "main", cmd: "stop" }], [0, 1, 2]).timer).toBeNull();
  });
});

// ───────── V1.2 ─────────

const lit: Action[] = [{ t: "start" }, { t: "arrive" }, { t: "light", on: true }, { t: "door", door: "dortoir", open: true }, { t: "chief", player: "p10" }, { t: "patientZero", player: "p1" }];
const door = (id: string): Action[] => [{ t: "vote", kind: "door", options: [id, "fouiller"] }, { t: "voteResult", choice: id }];
const quiet = (victim: string | null = null): Action[] => [{ t: "night" }, { t: "victim", player: victim }, { t: "dawn" }];

describe("V1.2: the access chain and the two doors", () => {
  it("proposes the plan's doors once their access is found, skips what's done, and searches when only one is left", () => {
    let s = run([...lit, ...quiet()]);
    expect(doorProposals(ANTARCTICA, s)).toEqual(["accueil", "sas"]);
    expect(actionAvailable(ANTARCTICA, s, "archives-fouille")).toBe(false); // no key yet
    s = run([...lit, ...quiet(), ...door("accueil")]);
    expect(s.flags.key).toBe(true);
    expect(s.actionsDone).toEqual(["accueil"]);
    s = run([...lit, ...quiet(), ...door("accueil"), { t: "exile", player: null }, ...quiet()]);
    expect(doorProposals(ANTARCTICA, s)).toEqual(["archives-panic", "archives-fouille"]);
    // Only the airlock left of what's open: the other door is « Fouiller ce qu'on connaît déjà ».
    const one = run([...lit, ...quiet(), { t: "dayAction", id: "accueil" }, { t: "dayAction", id: "archives-panic" }, { t: "dayAction", id: "archives-fouille" }, { t: "dayAction", id: "infirmerie" }, { t: "flag", flag: "code", on: false }]);
    expect(doorProposals(ANTARCTICA, { ...one, round: 4 })).toEqual(["sas", "fouiller"]);
  });

  it("the first entry into the archives opens their terminal on log 2; the search finds badge 2 and the tapes", () => {
    const s = run([...lit, ...quiet(), ...door("archives-fouille")]);
    expect(s).toMatchObject({ terminal: "beta", playing: "log2" });
    expect(s.flags.badge2).toBe(true);
    expect(s.found).toContain("bandes");
    expect(s.doors.beta).toBe(true);
  });

  it("imposes the laboratory on loop 2 day 3, and Marga forces it without the badge", () => {
    const loop2: Action[] = [...lit, ...quiet(), { t: "endLoop", winner: "meute" }, { t: "reboot" }, { t: "arrive" }, { t: "patientZero", player: "p2" }];
    const s = run([...loop2, ...quiet(), { t: "exile", player: null }, ...quiet(), { t: "exile", player: null }, ...quiet()]);
    expect(s).toMatchObject({ loop: 2, round: 3 });
    expect(doorProposals(ANTARCTICA, s)).toEqual(["labo"]);
    expect(doorProposals(ANTARCTICA, { ...s, round: 4 })).toEqual([]);
    const forced = run([...loop2, ...quiet(), { t: "labForce" }]);
    expect(forced.doors.labo).toBe(true);
    expect(forced.log.at(-1)?.text).toBe("Marga Berlioz force la porte du laboratoire.");
  });
});

describe("V1.2: the chief", () => {
  it("resists the pack's first attack in a loop, to kill or to contaminate; the second one works", () => {
    let s = run([...lit, ...quiet("p10")]);
    expect(s.players.find((p) => p.id === "p10")?.status).toBe("alive");
    expect(s.chiefResisted).toBe(true);
    expect(s.log.at(-1)?.text).toContain("Le chef Jade résiste à l'attaque : il perd sa résistance.");
    s = run([...lit, ...quiet("p10"), { t: "exile", player: null }, ...quiet("p10")]);
    expect(s.players.find((p) => p.id === "p10")?.status).toBe("dead");
    expect(s.chief).toBeNull(); // the title waits for a successor
    // V1.3: contaminated and killed the same night, the two attacks count as one.
    s = run([...lit, { t: "night" }, { t: "infect", player: "p10" }, { t: "victim", player: "p10" }, { t: "dawn" }]);
    expect(s.players.find((p) => p.id === "p10")).toMatchObject({ status: "alive", infected: false });
    expect(s.chiefResisted).toBe(true);
    expect(s.log.at(-1)?.text).toContain("résiste à la double attaque de la meute (contamination et mise à mort)");
    s = run([...lit, { t: "night" }, { t: "infect", player: "p10" }, { t: "victim", player: "p10" }, { t: "dawn" }, { t: "exile", player: null }, ...quiet("p10")]);
    expect(s.players.find((p) => p.id === "p10")?.status).toBe("dead"); // the next night, the first attack works
  });

  it("exiled while healthy, locks every power of the village until the end of the loop; contaminated, nothing happens", () => {
    const given: Action[] = [...lit, { t: "dayAction", id: "sas" }, { t: "giveItem", item: "pistolet", player: "p3" }, { t: "giveItem", item: "seringues", player: "p4" }];
    const exiled: Action[] = [...given, ...quiet(), { t: "exile", player: "p10" }];
    expect(run(exiled).locked).toBe(true);
    expect(run([...exiled, { t: "shoot", target: "p1" }]).items.pistolet?.used).toBe(false);
    expect(nightSteps(run([...exiled, { t: "night" }]), setup().params)).not.toContain("items");
    expect(run([...exiled, { t: "endLoop", winner: "meute" }, { t: "reboot" }]).locked).toBe(false);
    expect(run([...given, { t: "setInfected", player: "p10", infected: true }, ...quiet(), { t: "exile", player: "p10" }]).locked).toBe(false);
  });

  it("is to confirm at the start of loop 2", () => {
    const s = run([...lit, ...quiet(), { t: "endLoop", winner: "meute" }, { t: "reboot" }]);
    expect(s).toMatchObject({ chief: null, chiefB1: "p10", chiefToConfirm: true });
    expect(run([...lit, ...quiet(), { t: "endLoop", winner: "meute" }, { t: "reboot" }, { t: "chiefConfirm" }]).chief).toBe("p10");
  });

  it("is elected by the vote by moving", () => {
    const s = run([{ t: "start" }, { t: "arrive" }, { t: "vote", kind: "chief", options: ["p2", "p3"] }, { t: "voteResult", choice: "p3" }]);
    expect(s).toMatchObject({ chief: "p3", chiefB1: "p3", vote: null, timer: null });
  });
});

describe("V1.2: the powers", () => {
  const armed: Action[] = [...lit, { t: "dayAction", id: "sas" }, { t: "giveItem", item: "pistolet", player: "p3" }, ...quiet()];
  it("the pistol: a contaminated target dies, the shooter is trusted and loses the gun", () => {
    const s = run([...armed, { t: "shoot", target: "p1" }]);
    expect(s.players.find((p) => p.id === "p1")?.status).toBe("dead");
    expect(s.players.find((p) => p.id === "p3")?.status).toBe("alive");
    expect(s.trusted).toEqual(["p3"]);
    expect(s.items.pistolet).toEqual({ holder: null, used: true });
  });

  it("the pistol: a healthy target dies with the shooter; by day only, one cartridge", () => {
    const s = run([...armed, { t: "shoot", target: "p5" }]);
    expect(s.players.filter((p) => p.status === "dead").map((p) => p.id)).toEqual(["p3", "p5"]);
    expect(s.lastShot).toEqual({ shooter: "p3", target: "p5", infected: false });
    expect(s.locked).toBe(false); // a shot isn't an exile
    expect(run([...armed, { t: "night" }, { t: "shoot", target: "p1" }]).items.pistolet?.used).toBe(false);
    expect(run([...armed, { t: "shoot", target: "p1" }, { t: "giveItem", item: "pistolet", player: "p4" }, { t: "shoot", target: "p5" }]).players.find((p) => p.id === "p5")?.status).toBe("alive");
  });

  it("the blood test: once a loop, and negative for whoever was contaminated last night", () => {
    const tested: Action[] = [...lit, { t: "dayAction", id: "infirmerie" }];
    expect(run([...tested, ...quiet(), { t: "bloodTest", target: "p1" }]).lastTest).toEqual({ target: "p1", positive: true });
    const fresh = run([...tested, { t: "night" }, { t: "infect", player: "p2" }, { t: "victim", player: null }, { t: "dawn" }, { t: "bloodTest", target: "p2" }]);
    expect(fresh.lastTest).toEqual({ target: "p2", positive: false });
    expect(run([...tested, ...quiet(), { t: "bloodTest", target: "p5" }, { t: "bloodTest", target: "p1" }]).lastTest?.target).toBe("p5");
    expect(run([...lit, ...quiet(), { t: "bloodTest", target: "p1" }]).lastTest).toBeNull(); // not found yet
  });

  it("the radio: the contaminated still alive, once a loop", () => {
    const s = run([...lit, { t: "dayAction", id: "securite" }, { t: "night" }, { t: "infect", player: "p2" }, { t: "victim", player: null }, { t: "dawn" }, { t: "radio" }]);
    expect(s.lastRadio).toBe(2);
    expect(s.roomUsed.radio).toBe(true);
  });

  it("the quarantine protects its two players the next night", () => {
    const s = run([...lit, ...quiet(), { t: "quarantine", players: ["p4", "p5"] }, { t: "exile", player: null }, { t: "night" }, { t: "infect", player: "p5" }, { t: "victim", player: "p4" }, { t: "dawn" }]);
    expect(s.players.find((p) => p.id === "p4")?.status).toBe("alive");
    expect(s.players.find((p) => p.id === "p5")?.infected).toBe(false);
    expect(s.quarantine).toEqual([]);
  });

  it("the syringes go together, to one holder", () => {
    const s = run([...lit, { t: "giveItem", item: "seringues", player: "p6" }]);
    expect(s.items.vie?.holder).toBe("p6");
    expect(s.items.mort?.holder).toBe("p6");
  });
});

describe("V1.2: the dead's moment and the events", () => {
  it("comes only when someone other than tonight's victim is dead, with two events not played yet", () => {
    expect(nightSteps(run([...lit, ...quiet(), { t: "exile", player: null }, { t: "night" }]), setup().params)).not.toContain("dead");
    const s = run([...lit, ...quiet("p5"), { t: "exile", player: null }, { t: "night" }]);
    expect(nightSteps(s, setup().params)).toContain("dead");
    expect(proposals(s, setup())).toHaveLength(2);
  });

  it("plays each event once in the evening", () => {
    const s = run([...lit, ...night(null, "p5", "blizzard"), { t: "exile", player: null }, { t: "night" }]);
    expect(s.eventsPlayed).toEqual(["blizzard"]);
    for (let n = 0; n < 6; n++) expect(proposals({ ...s, round: n + 2 }, setup())).not.toContain("blizzard");
    expect(run([...lit, ...night(null, "p5", "delestage")]).dark).toBe(true);
  });

  it("the confinement runs its six minutes, and the fire door opens again", () => {
    const s = run([...lit, ...quiet(), { t: "confinement", on: true }]);
    expect(s.confinement).toBe(true);
    expect(s.timer).toMatchObject({ label: "Confinement", total: 360 });
    expect(run([...lit, ...quiet(), { t: "confinement", on: true }, { t: "confinement", on: false }])).toMatchObject({ confinement: false, timer: null });
  });
});

describe("V1.2: the reboot", () => {
  it("keeps what was found, resets the uses, clears the holders, and asks to confirm the chief", () => {
    const s = run([
      ...lit,
      { t: "dayAction", id: "infirmerie" },
      { t: "giveItem", item: "seringues", player: "p4" },
      { t: "night" },
      { t: "victim", player: "p5" },
      { t: "useItem", item: "vie", target: "p5" },
      { t: "dawn" },
      { t: "bloodTest", target: "p2" },
      { t: "endLoop", winner: "meute" },
      { t: "reboot" },
    ]);
    expect(s.found).toEqual(expect.arrayContaining(["seringues", "test"]));
    expect(s.flags.code).toBe(true);
    expect(s.items.vie).toEqual({ holder: null, used: false });
    expect(s.roomUsed).toEqual({ test: false, radio: false });
    expect(s.chiefToConfirm).toBe(true);
  });
});

describe("V1.3", () => {
  it("a chief in the panic room keeps the resistance: the room protected them first", () => {
    const repaired: Action[] = [{ t: "switch", index: 0, up: true }, { t: "switch", index: 2, up: true }, { t: "switch", index: 3, up: true }, { t: "power" }];
    const s = run([...lit, ...repaired, ...quiet(), { t: "panic", player: "p10" }, { t: "exile", player: null }, { t: "night" }, { t: "victim", player: "p10" }, { t: "dawn" }]);
    expect(s.players.find((p) => p.id === "p10")?.status).toBe("alive");
    expect(s.chiefResisted).toBe(false);
  });

  it("« Lever le délestage » brings the light back", () => {
    const dark = run([...lit, ...night(null, "p5", "delestage")]);
    expect(dark.dark).toBe(true);
    const lifted = run([...lit, ...night(null, "p5", "delestage"), { t: "dark", on: false }]);
    expect(lifted.dark).toBe(false);
    expect(lifted.log.at(-1)?.text).toBe("Délestage levé : l'éclairage revient.");
  });

  it("the quarantine, the blood test and the radio stay all day, through Stop and the neutral screen, until the night is over", () => {
    const day: Action[] = [...lit, { t: "dayAction", id: "infirmerie" }, { t: "dayAction", id: "securite" }, ...quiet(), { t: "quarantine", players: ["p4", "p5"] }, { t: "bloodTest", target: "p1" }, { t: "radio" }];
    const s = run([...day, { t: "stop" }, { t: "neutral", mode: "plan" }, { t: "neutral", mode: null }]);
    expect(s).toMatchObject({ quarantine: ["p4", "p5"], lastTest: { target: "p1", positive: true }, lastRadio: 1 });
    const next = run([...day, { t: "exile", player: null }, ...quiet()]);
    expect(next).toMatchObject({ quarantine: [], lastTest: null, lastRadio: null });
    expect(run([...day, { t: "exile", player: null }, { t: "night" }]).quarantine).toEqual(["p4", "p5"]); // they're protected tonight
  });
});
