import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, type MemberStats } from "./catalog";

const BASE_STATS: MemberStats = {
  memberNumber: 42,
  itemsListedCount: 0,
  consecutiveOnTimeReturns: 0,
  cumulativeLateReturns: 0,
  fastestApprovalMinutes: null,
  materialSharedValueCents: 0,
  referralCount: 0,
  hadCollectiveWeekend: false,
  hadLateNightPickup: false,
  hasUnbreakableItem: false,
  isPureLender: false,
};

function find(key: string) {
  const def = ACHIEVEMENTS.find((a) => a.key === key);
  if (!def) throw new Error(`Unknown achievement key: ${key}`);
  return def;
}

describe("achievement catalog", () => {
  it("has unique keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe("membre-fondateur", () => {
    const def = find("membre-fondateur");
    it("unlocks for member #1 through #5", () => {
      expect(def.evaluate({ ...BASE_STATS, memberNumber: 1 })).toBe(true);
      expect(def.evaluate({ ...BASE_STATS, memberNumber: 5 })).toBe(true);
    });
    it("does not unlock for member #6 or null", () => {
      expect(def.evaluate({ ...BASE_STATS, memberNumber: 6 })).toBe(false);
      expect(def.evaluate({ ...BASE_STATS, memberNumber: null })).toBe(false);
    });
  });

  describe("quincaillier", () => {
    const def = find("quincaillier");
    it("unlocks at exactly 10 items", () => {
      expect(def.evaluate({ ...BASE_STATS, itemsListedCount: 10 })).toBe(true);
    });
    it("does not unlock below 10", () => {
      expect(def.evaluate({ ...BASE_STATS, itemsListedCount: 9 })).toBe(false);
    });
  });

  describe("toujours-a-lheure", () => {
    const def = find("toujours-a-lheure");
    it("unlocks at a 10-return streak", () => {
      expect(def.evaluate({ ...BASE_STATS, consecutiveOnTimeReturns: 10 })).toBe(true);
    });
    it("does not unlock at 9", () => {
      expect(def.evaluate({ ...BASE_STATS, consecutiveOnTimeReturns: 9 })).toBe(false);
    });
  });

  describe("tete-en-lair", () => {
    const def = find("tete-en-lair");
    it("unlocks at 3 cumulative late returns", () => {
      expect(def.evaluate({ ...BASE_STATS, cumulativeLateReturns: 3 })).toBe(true);
    });
    it("does not unlock at 2", () => {
      expect(def.evaluate({ ...BASE_STATS, cumulativeLateReturns: 2 })).toBe(false);
    });
  });

  describe("sauveur", () => {
    const def = find("sauveur");
    it("unlocks under an hour", () => {
      expect(def.evaluate({ ...BASE_STATS, fastestApprovalMinutes: 59 })).toBe(true);
    });
    it("does not unlock at exactly 60 minutes or never-approved", () => {
      expect(def.evaluate({ ...BASE_STATS, fastestApprovalMinutes: 60 })).toBe(false);
      expect(def.evaluate({ ...BASE_STATS, fastestApprovalMinutes: null })).toBe(false);
    });
  });

  describe("le-mecene", () => {
    const def = find("le-mecene");
    it("unlocks strictly above 1000€", () => {
      expect(def.evaluate({ ...BASE_STATS, materialSharedValueCents: 100_001 })).toBe(true);
    });
    it("does not unlock at exactly 1000€", () => {
      expect(def.evaluate({ ...BASE_STATS, materialSharedValueCents: 100_000 })).toBe(false);
    });
  });

  describe("chantier-collectif", () => {
    const def = find("chantier-collectif");
    it("unlocks only when the flag is set", () => {
      expect(def.evaluate({ ...BASE_STATS, hadCollectiveWeekend: true })).toBe(true);
      expect(def.evaluate({ ...BASE_STATS, hadCollectiveWeekend: false })).toBe(false);
    });
  });

  describe("parrain", () => {
    const def = find("parrain");
    it("unlocks at 3 referrals", () => {
      expect(def.evaluate({ ...BASE_STATS, referralCount: 3 })).toBe(true);
    });
    it("does not unlock at 2", () => {
      expect(def.evaluate({ ...BASE_STATS, referralCount: 2 })).toBe(false);
    });
  });

  describe("oiseau-de-nuit", () => {
    const def = find("oiseau-de-nuit");
    it("is marked secret and unlocks on the flag", () => {
      expect(def.secret).toBe(true);
      expect(def.evaluate({ ...BASE_STATS, hadLateNightPickup: true })).toBe(true);
      expect(def.evaluate({ ...BASE_STATS, hadLateNightPickup: false })).toBe(false);
    });
  });

  describe("increvable", () => {
    const def = find("increvable");
    it("is marked secret and unlocks on the flag", () => {
      expect(def.secret).toBe(true);
      expect(def.evaluate({ ...BASE_STATS, hasUnbreakableItem: true })).toBe(true);
    });
  });

  describe("vide-grenier", () => {
    const def = find("vide-grenier");
    it("requires both pure-lender status and enough items", () => {
      expect(def.evaluate({ ...BASE_STATS, isPureLender: true, itemsListedCount: 3 })).toBe(true);
      expect(def.evaluate({ ...BASE_STATS, isPureLender: true, itemsListedCount: 2 })).toBe(false);
      expect(def.evaluate({ ...BASE_STATS, isPureLender: false, itemsListedCount: 5 })).toBe(false);
    });
  });
});
