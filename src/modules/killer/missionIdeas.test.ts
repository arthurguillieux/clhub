import { describe, expect, it } from "vitest";
import { MISSION_IDEAS, isMissionIdea, pickMissionIdea } from "./missionIdeas";

describe("mission ideas", () => {
  it("are plenty, all different, and fit in a mission field", () => {
    expect(MISSION_IDEAS.length).toBeGreaterThanOrEqual(80);
    expect(new Set(MISSION_IDEAS).size).toBe(MISSION_IDEAS.length);
    for (const idea of MISSION_IDEAS) {
      expect(idea.startsWith("Lui faire ")).toBe(true);
      expect(idea.length).toBeLessThanOrEqual(600); // MAX_MISSION_LENGTH in data/games
      expect(idea).toBe(idea.trim());
    }
  });

  it("never hands out an idea already used in the game while others are left", () => {
    const used = MISSION_IDEAS.slice(0, -1);
    expect(pickMissionIdea(used, () => 0)).toBe(MISSION_IDEAS[MISSION_IDEAS.length - 1]);
  });

  it("still answers once every idea has been used", () => {
    expect(MISSION_IDEAS).toContain(pickMissionIdea(MISSION_IDEAS, () => 0.5));
  });

  it("recognises an untouched idea, not an edited one", () => {
    expect(isMissionIdea(MISSION_IDEAS[0]!)).toBe(true);
    expect(isMissionIdea(`${MISSION_IDEAS[0]} en chantant`)).toBe(false);
    expect(isMissionIdea("")).toBe(false);
  });
});
