import { describe, expect, it } from "vitest";
import {
  buildCircle,
  circleNames,
  eliminate,
  endStats,
  findKiller,
  insertLate,
  shuffledOrder,
  undoKill,
  type Patch,
  type Tribute,
} from "./circle";

function lobby(...names: string[]): Tribute[] {
  return names.map((name, i) => ({ id: name.toLowerCase(), name, position: i, targetId: null, alive: true, killedAt: null, killedById: null }));
}
function apply(tributes: Tribute[], patches: Patch[]): Tribute[] {
  return tributes.map((t) => {
    const p = patches.find((x) => x.id === t.id);
    return p ? { ...t, ...p } : t;
  });
}
const started = (...names: string[]) => {
  const t = lobby(...names);
  return apply(t, buildCircle(t));
};
const T0 = new Date("2026-10-24T20:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60000);

describe("buildCircle", () => {
  it("follows the lobby order and closes the loop", () => {
    const t = started("Paul", "Marie", "Léa");
    expect(t.map((x) => x.targetId)).toEqual(["marie", "léa", "paul"]);
    expect(circleNames(t)).toEqual(["Paul", "Marie", "Léa", "Paul"]);
  });

  it("needs at least two tributes", () => {
    expect(buildCircle(lobby("Seul"))).toEqual([]);
  });

  it("shuffles deterministically with an injected random source", () => {
    const order = shuffledOrder([1, 2, 3, 4], () => 0);
    expect(order.sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("eliminate", () => {
  it("gives the killer the victim's target (and so the victim's mission's holder)", () => {
    let t = started("Paul", "Marie", "Léa", "Tom");
    const r = eliminate(t, "marie", at(10));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kill).toEqual({ victimId: "marie", killerId: "paul", inheritedTargetId: "léa" });
    t = apply(t, r.patches);
    expect(t.find((x) => x.id === "paul")!.targetId).toBe("léa");
    expect(t.find((x) => x.id === "marie")!.alive).toBe(false);
    expect(circleNames(t)).toEqual(["Paul", "Léa", "Tom", "Paul"]);
    expect(r.finished).toBe(false);
  });

  it("finishes when one tribute is left", () => {
    let t = started("Paul", "Marie");
    const r = eliminate(t, "marie", at(5));
    expect(r.ok && r.finished).toBe(true);
    if (r.ok) t = apply(t, r.patches);
    expect(t.find((x) => x.id === "paul")!.targetId).toBe("paul");
  });

  it("refuses a tribute already fallen", () => {
    let t = started("Paul", "Marie", "Léa");
    const r = eliminate(t, "marie", at(1));
    if (r.ok) t = apply(t, r.patches);
    expect(eliminate(t, "marie", at(2)).ok).toBe(false);
  });

  it("finds the hunter of a victim", () => {
    expect(findKiller(started("Paul", "Marie", "Léa"), "paul")!.id).toBe("léa");
  });
});

describe("undoKill", () => {
  it("restores the circle exactly", () => {
    const before = started("Paul", "Marie", "Léa", "Tom");
    const r = eliminate(before, "léa", at(3));
    if (!r.ok) throw new Error(r.error);
    const after = apply(apply(before, r.patches), undoKill(r.kill));
    expect(after).toEqual(before);
  });
});

describe("insertLate", () => {
  it("slots the newcomer after a living tribute", () => {
    let t = started("Paul", "Marie", "Léa");
    t = [...t, { id: "zoé", name: "Zoé", position: 3, targetId: null, alive: true, killedAt: null, killedById: null }];
    const r = insertLate(t, "zoé", "marie");
    if (!r.ok) throw new Error(r.error);
    t = apply(t, r.patches);
    expect(circleNames(t)).toEqual(["Paul", "Marie", "Zoé", "Léa", "Paul"]);
  });

  it("refuses a dead host", () => {
    let t = started("Paul", "Marie", "Léa");
    const r = eliminate(t, "marie", at(1));
    if (r.ok) t = apply(t, r.patches);
    expect(insertLate(t, "zoé", "marie").ok).toBe(false);
  });
});

describe("endStats", () => {
  it("builds the wrapped figures", () => {
    let t = started("Paul", "Marie", "Léa", "Tom");
    for (const [victim, minute] of [["marie", 12], ["léa", 40], ["tom", 75]] as const) {
      const r = eliminate(t, victim, at(minute));
      if (!r.ok) throw new Error(r.error);
      t = apply(t, r.patches);
    }
    const s = endStats(t, T0, at(75));
    expect(s.winner?.name).toBe("Paul");
    expect(s.podium[0]).toEqual({ id: "paul", name: "Paul", kills: 3 });
    expect(s.durationMinutes).toBe(75);
    expect(s.firstFallen).toEqual({ id: "marie", name: "Marie", minutesIn: 12 });
    expect(s.lastFallen?.name).toBe("Tom");
    expect(s.fastestKill?.minutesIn).toBe(12);
    expect(s.totalKills).toBe(3);
  });
});
