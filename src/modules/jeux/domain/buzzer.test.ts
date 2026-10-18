import { describe, expect, it } from "vitest";
import {
  MAX_TEAMS,
  applyHostAction,
  buzz,
  cleanName,
  initialState,
  joinTeam,
  toView,
  type BuzzerState,
} from "./buzzer";
import { AVATARS } from "./avatars";

let counter = 0;
function join(state: BuzzerState, name: string, avatarId: string | null = null, token: string | null = null) {
  counter++;
  const result = joinTeam(state, { name, avatarId, token, freshTeamId: `team-${counter}`, freshToken: `token-${counter}` });
  if (!result.ok) throw new Error(result.error);
  return result;
}

function gameWith(...names: string[]): BuzzerState {
  return names.reduce((state, name) => join(state, name).state, initialState());
}

const idOf = (state: BuzzerState, name: string) => state.teams.find((t) => t.name === name)!.id;
const tokenOf = (state: BuzzerState, name: string) => state.teams.find((t) => t.name === name)!.token;

describe("joinTeam", () => {
  it("gives a new team the first free animal when none is chosen", () => {
    const { state } = join(initialState(), "Les Fous");
    expect(state.teams[0]!.avatarId).toBe(AVATARS[0]!.id);
    const second = join(state, "Les Sages");
    expect(second.team.avatarId).toBe(AVATARS[1]!.id);
  });

  it("refuses an animal another team already has", () => {
    const { state } = join(initialState(), "A", "renard");
    const result = joinTeam(state, { name: "B", avatarId: "renard", token: null, freshTeamId: "x", freshToken: "y" });
    expect(result).toEqual({ ok: false, error: "Cet animal vient d'être pris, choisis-en un autre" });
  });

  it("lets a team keep its own animal when it renames itself", () => {
    const first = join(initialState(), "A", "renard");
    const renamed = join(first.state, "A bis", "renard", first.team.token);
    expect(renamed.state.teams).toHaveLength(1);
    expect(renamed.state.teams[0]!.name).toBe("A bis");
  });

  it("lets a team switch to a free animal and frees the old one", () => {
    const first = join(initialState(), "A", "renard");
    const switched = join(first.state, "A", "dino", first.team.token);
    expect(switched.team.avatarId).toBe("dino");
    expect(join(switched.state, "B", "renard").team.avatarId).toBe("renard");
  });

  it("treats an unknown token as a brand-new team", () => {
    const { state } = join(initialState(), "A");
    const result = join(state, "B", null, "stale-token");
    expect(result.state.teams).toHaveLength(2);
  });

  it("rejects an empty name and an unknown animal", () => {
    const base = { avatarId: null, token: null, freshTeamId: "x", freshToken: "y" };
    expect(joinTeam(initialState(), { ...base, name: "   " }).ok).toBe(false);
    expect(joinTeam(initialState(), { ...base, name: "A", avatarId: "licorne" }).ok).toBe(false);
  });

  it("stops at MAX_TEAMS", () => {
    let state = initialState();
    for (let i = 0; i < MAX_TEAMS; i++) state = join(state, `Equipe ${i}`).state;
    const result = joinTeam(state, { name: "Trop", avatarId: null, token: null, freshTeamId: "x", freshToken: "y" });
    expect(result.ok).toBe(false);
  });

  it("collapses whitespace and caps the name length", () => {
    expect(cleanName("  Les   Têtes\n de   Nœud  ")).toBe("Les Têtes de Nœud");
    expect(cleanName("x".repeat(100))).toHaveLength(24);
  });
});

describe("buzz", () => {
  it("is ignored while the buzzers are closed", () => {
    const state = gameWith("A", "B");
    expect(buzz(state, tokenOf(state, "A")).kind).toBe("ignored");
  });

  it("locks in the first team and ignores the second", () => {
    let state = applyHostAction(gameWith("A", "B"), { type: "open" });
    const first = buzz(state, tokenOf(state, "A"));
    expect(first.kind).toBe("buzzed");
    if (first.kind !== "buzzed") return;
    state = first.state;
    expect(state.phase).toBe("buzzed");
    expect(state.winnerId).toBe(idOf(state, "A"));
    expect(state.buzzSeq).toBe(1);

    const second = buzz(state, tokenOf(state, "B"));
    expect(second.kind).toBe("ignored");
    if (second.kind === "ignored") expect(second.state.winnerId).toBe(idOf(state, "A"));
  });

  it("reports an unknown token", () => {
    expect(buzz(gameWith("A"), "nope").kind).toBe("unknown-team");
  });

  it("ignores a team that is out", () => {
    let state = applyHostAction(gameWith("A", "B"), { type: "open" });
    state = (buzz(state, tokenOf(state, "A")) as { state: BuzzerState }).state;
    state = applyHostAction(state, { type: "wrong" });
    expect(state.phase).toBe("open");
    expect(buzz(state, tokenOf(state, "A")).kind).toBe("ignored");
    expect(buzz(state, tokenOf(state, "B")).kind).toBe("buzzed");
  });
});

describe("host actions", () => {
  function buzzedBy(name: string, ...names: string[]): BuzzerState {
    let state = applyHostAction(gameWith(name, ...names), { type: "open" });
    state = (buzz(state, tokenOf(state, name)) as { state: BuzzerState }).state;
    return state;
  }

  it("correct answer scores the winner and closes the round", () => {
    const state = applyHostAction(buzzedBy("A", "B"), { type: "correct", points: 3 });
    expect(state.teams.find((t) => t.name === "A")!.score).toBe(3);
    expect(state.teams.find((t) => t.name === "B")!.score).toBe(0);
    expect(state.phase).toBe("closed");
    expect(state.winnerId).toBeNull();
  });

  it("wrong answer eliminates the winner and reopens for the others", () => {
    const state = applyHostAction(buzzedBy("A", "B"), { type: "wrong" });
    expect(state.teams.find((t) => t.name === "A")!.out).toBe(true);
    expect(state.phase).toBe("open");
  });

  it("closes the round when the last team gets it wrong", () => {
    let state = buzzedBy("A");
    state = applyHostAction(state, { type: "wrong" });
    expect(state.phase).toBe("closed");
  });

  it("opening a new round brings everyone back in", () => {
    let state = applyHostAction(buzzedBy("A", "B"), { type: "wrong" });
    state = applyHostAction(state, { type: "open" });
    expect(state.teams.every((t) => !t.out)).toBe(true);
    expect(state.phase).toBe("open");
  });

  it("cancel gives the round back with no penalty", () => {
    const state = applyHostAction(buzzedBy("A", "B"), { type: "cancel" });
    expect(state.phase).toBe("open");
    expect(state.teams.every((t) => !t.out && t.score === 0)).toBe(true);
  });

  it("correct / wrong / cancel do nothing when nobody has buzzed", () => {
    const state = applyHostAction(gameWith("A"), { type: "open" });
    for (const type of ["wrong", "cancel"] as const) {
      expect(applyHostAction(state, { type })).toBe(state);
    }
    expect(applyHostAction(state, { type: "correct", points: 1 })).toBe(state);
  });

  it("removing the team that just buzzed hands the round back", () => {
    const buzzed = buzzedBy("A", "B");
    const state = applyHostAction(buzzed, { type: "remove", teamId: idOf(buzzed, "A") });
    expect(state.teams.map((t) => t.name)).toEqual(["B"]);
    expect(state.phase).toBe("open");
    expect(state.winnerId).toBeNull();
  });

  it("removing another team leaves the buzz in place", () => {
    const buzzed = buzzedBy("A", "B");
    const state = applyHostAction(buzzed, { type: "remove", teamId: idOf(buzzed, "B") });
    expect(state.phase).toBe("buzzed");
    expect(state.winnerId).toBe(idOf(buzzed, "A"));
  });

  it("adjusts scores by hand, rename ignores blank names", () => {
    let state = gameWith("A");
    const id = idOf(state, "A");
    state = applyHostAction(state, { type: "score", teamId: id, delta: 2 });
    state = applyHostAction(state, { type: "score", teamId: id, delta: -1 });
    expect(state.teams[0]!.score).toBe(1);
    expect(applyHostAction(state, { type: "rename", teamId: id, name: "   " })).toBe(state);
    expect(applyHostAction(state, { type: "rename", teamId: id, name: " Neo " }).teams[0]!.name).toBe("Neo");
  });

  it("resetAll zeroes scores and eliminations", () => {
    let state = applyHostAction(buzzedBy("A", "B"), { type: "correct", points: 5 });
    state = applyHostAction(state, { type: "resetAll" });
    expect(state.teams.every((t) => t.score === 0 && !t.out)).toBe(true);
    expect(state.phase).toBe("closed");
  });

  it("start and lobby toggle the screen and always leave buzzers closed", () => {
    let state = applyHostAction(buzzedBy("A"), { type: "start" });
    expect(state.started).toBe(true);
    expect(state.phase).toBe("closed");
    state = applyHostAction(state, { type: "lobby" });
    expect(state.started).toBe(false);
  });
});

describe("toView", () => {
  it("never leaks tokens and reports online status per team", () => {
    const state = gameWith("A", "B");
    const view = toView(state, { code: "ABC123", version: 4, ended: false }, (token) => token === tokenOf(state, "A"));
    expect(JSON.stringify(view)).not.toContain("token-");
    expect(view.teams.map((t) => t.online)).toEqual([true, false]);
    expect(view.teams[0]!.color).toBe(AVATARS[0]!.color);
    expect(view.version).toBe(4);
  });
});
