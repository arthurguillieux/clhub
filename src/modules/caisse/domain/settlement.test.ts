import { describe, expect, it } from "vitest";
import {
  applySettlements,
  computeBalances,
  computeFairShares,
  suggestTransfers,
  type Balance,
} from "./settlement";

describe("computeFairShares", () => {
  it("splits evenly with no remainder", () => {
    const shares = computeFairShares(9000, [
      { memberId: "a", shares: 1 },
      { memberId: "b", shares: 1 },
      { memberId: "c", shares: 1 },
    ]);
    expect(shares.get("a")).toBe(3000);
    expect(shares.get("b")).toBe(3000);
    expect(shares.get("c")).toBe(3000);
  });

  it("distributes the leftover cents from a non-dividing split, summing back to the exact total", () => {
    // 10000 / 3 = 3333.33... — someone has to eat the extra cent.
    const shares = computeFairShares(10000, [
      { memberId: "a", shares: 1 },
      { memberId: "b", shares: 1 },
      { memberId: "c", shares: 1 },
    ]);
    const total = [...shares.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(10000);
    // Every share is within a cent of the exact 3333.33 — no one is off by more than the rounding itself.
    for (const v of shares.values()) {
      expect(v === 3333 || v === 3334).toBe(true);
    }
  });

  it("weights by shares, not by headcount — a 2-share member owes twice a 1-share member", () => {
    // Total 8000, shares 2 vs 1 → 3 total shares → 5333/2667 (largest remainder).
    const shares = computeFairShares(8000, [
      { memberId: "household", shares: 2 },
      { memberId: "solo", shares: 1 },
    ]);
    const household = shares.get("household")!;
    const solo = shares.get("solo")!;
    expect(household + solo).toBe(8000);
    expect(household).toBeGreaterThan(solo * 1.5);
  });

  it("gives everyone zero when the total is zero", () => {
    const shares = computeFairShares(0, [
      { memberId: "a", shares: 1 },
      { memberId: "b", shares: 3 },
    ]);
    expect(shares.get("a")).toBe(0);
    expect(shares.get("b")).toBe(0);
  });

  it("doesn't blow up with zero total shares", () => {
    const shares = computeFairShares(5000, [{ memberId: "a", shares: 0 }]);
    expect(shares.get("a")).toBe(0);
  });
});

describe("computeBalances", () => {
  it("matches Arthur's own example: a 2-share pair and a 1-share solo member", () => {
    // "Arthur et Marine ont dépensé 60€ (mais ils sont deux), Tanguy a dépensé 20€ (mais tout seul)"
    const balances = computeBalances(
      [
        { amountCents: 6000, paidByMemberId: "arthur-marine" },
        { amountCents: 2000, paidByMemberId: "tanguy" },
      ],
      [
        { memberId: "arthur-marine", shares: 2 },
        { memberId: "tanguy", shares: 1 },
      ],
    );
    const total = 8000;
    const householdShare = Math.round((total * 2) / 3); // 5333
    const soloShare = total - householdShare; // 2667

    const household = balances.find((b) => b.memberId === "arthur-marine")!;
    const solo = balances.find((b) => b.memberId === "tanguy")!;
    expect(household.paidCents).toBe(6000);
    expect(household.fairShareCents).toBe(householdShare);
    expect(household.rawBalanceCents).toBe(6000 - householdShare); // owed money
    expect(solo.paidCents).toBe(2000);
    expect(solo.fairShareCents).toBe(soloShare);
    expect(solo.rawBalanceCents).toBe(2000 - soloShare); // owes money
  });

  it("balances always sum to zero — nobody's fair share can create or destroy money", () => {
    const balances = computeBalances(
      [
        { amountCents: 4321, paidByMemberId: "a" },
        { amountCents: 999, paidByMemberId: "b" },
        { amountCents: 1500, paidByMemberId: "a" },
      ],
      [
        { memberId: "a", shares: 1 },
        { memberId: "b", shares: 2 },
        { memberId: "c", shares: 3 },
      ],
    );
    const sum = balances.reduce((s, b) => s + b.rawBalanceCents, 0);
    expect(sum).toBe(0);
  });

  it("a member with no expenses of their own still gets a fair share to owe", () => {
    const balances = computeBalances(
      [{ amountCents: 3000, paidByMemberId: "payer" }],
      [
        { memberId: "payer", shares: 1 },
        { memberId: "freeloader", shares: 1 },
      ],
    );
    const freeloader = balances.find((b) => b.memberId === "freeloader")!;
    expect(freeloader.paidCents).toBe(0);
    expect(freeloader.rawBalanceCents).toBeLessThan(0);
  });

  it("returns all-zero balances for an event with no expenses yet", () => {
    const balances = computeBalances([], [{ memberId: "a", shares: 1 }]);
    expect(balances).toEqual([{ memberId: "a", paidCents: 0, fairShareCents: 0, rawBalanceCents: 0 }]);
  });
});

describe("applySettlements", () => {
  it("a full reimbursement zeroes out both sides", () => {
    const balances: Balance[] = [
      { memberId: "creditor", paidCents: 6000, fairShareCents: 4000, rawBalanceCents: 2000 },
      { memberId: "debtor", paidCents: 2000, fairShareCents: 4000, rawBalanceCents: -2000 },
    ];
    const net = applySettlements(balances, [
      { fromMemberId: "debtor", toMemberId: "creditor", amountCents: 2000 },
    ]);
    expect(net.get("debtor")).toBe(0);
    expect(net.get("creditor")).toBe(0);
  });

  it("a partial reimbursement leaves the remainder outstanding", () => {
    const balances: Balance[] = [
      { memberId: "creditor", paidCents: 6000, fairShareCents: 4000, rawBalanceCents: 2000 },
      { memberId: "debtor", paidCents: 2000, fairShareCents: 4000, rawBalanceCents: -2000 },
    ];
    const net = applySettlements(balances, [
      { fromMemberId: "debtor", toMemberId: "creditor", amountCents: 500 },
    ]);
    expect(net.get("debtor")).toBe(-1500);
    expect(net.get("creditor")).toBe(1500);
  });

  it("with no settlements recorded, net balances equal the raw balances", () => {
    const balances: Balance[] = [{ memberId: "a", paidCents: 100, fairShareCents: 50, rawBalanceCents: 50 }];
    const net = applySettlements(balances, []);
    expect(net.get("a")).toBe(50);
  });
});

describe("suggestTransfers", () => {
  it("suggests a single transfer for the simplest two-person case", () => {
    const net = new Map([
      ["creditor", 2000],
      ["debtor", -2000],
    ]);
    const transfers = suggestTransfers(net);
    expect(transfers).toEqual([{ fromMemberId: "debtor", toMemberId: "creditor", amountCents: 2000 }]);
  });

  it("suggests nothing once everyone is settled", () => {
    const net = new Map([
      ["a", 0],
      ["b", 0],
    ]);
    expect(suggestTransfers(net)).toEqual([]);
  });

  it("uses at most n-1 transfers for n unsettled members, never one per pair", () => {
    // 4 debtors owing a single creditor everything — a naive pairwise
    // settlement would need up to 6 transfers (every pair); the minimal
    // solution needs exactly 4 (one per debtor).
    const net = new Map([
      ["creditor", 4000],
      ["d1", -1000],
      ["d2", -1000],
      ["d3", -1000],
      ["d4", -1000],
    ]);
    const transfers = suggestTransfers(net);
    expect(transfers.length).toBeLessThanOrEqual(4);
    const totalTransferred = transfers.reduce((s, t) => s + t.amountCents, 0);
    expect(totalTransferred).toBe(4000);
  });

  it("every suggested transfer, once applied, brings all balances to exactly zero", () => {
    const net = new Map([
      ["a", 5000],
      ["b", -3000],
      ["c", -2000],
    ]);
    const transfers = suggestTransfers(net);
    const after = new Map(net);
    for (const t of transfers) {
      after.set(t.fromMemberId, (after.get(t.fromMemberId) ?? 0) + t.amountCents);
      after.set(t.toMemberId, (after.get(t.toMemberId) ?? 0) - t.amountCents);
    }
    for (const balance of after.values()) {
      expect(balance).toBe(0);
    }
  });

  it("handles an already-single-member map without transfers", () => {
    expect(suggestTransfers(new Map([["solo", 0]]))).toEqual([]);
  });
});
