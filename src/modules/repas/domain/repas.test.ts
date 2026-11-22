import { describe, expect, it } from "vitest";
import { amount, coverage, feast, parseAmount, restOf } from "./list";
import { proposeList, templateOf } from "./templates";

describe("the calculator", () => {
  it("proposes a raclette for 6 non-végés and 2 végés, rounded up, in kilos above a kilo", () => {
    const list = proposeList(templateOf("raclette")!, { meat: 6, vege: 2 });
    const by = Object.fromEntries(list.map((l) => [l.label, `${l.quantity} ${l.unit}`]));
    expect(by["Fromage à raclette"]).toBe("1.6 kg");
    expect(by["Pommes de terre"]).toBe("2.4 kg");
    expect(by["Charcuterie"]).toBe("750 g"); // 6 × 120 = 720, rounded up to 50 g
    expect(by["Champignons et légumes à griller"]).toBe("300 g");
    expect(by["Cornichons"]).toBe("1 bocal");
    expect(by["Vin blanc"]).toBe("3 bouteille");
    expect(by["Appareil à raclette"]).toBe("1 appareil");
  });

  it("leaves out what nobody eats", () => {
    const allVege = proposeList(templateOf("raclette")!, { meat: 0, vege: 4 }).map((l) => l.label);
    expect(allVege).not.toContain("Charcuterie");
    expect(allVege).toContain("Champignons et légumes à griller");
    expect(proposeList(templateOf("raclette")!, { meat: 0, vege: 0 })).toEqual([]);
  });
});

describe("qui ramène quoi", () => {
  it("covers a line with amounts, or with any claim when it has none", () => {
    expect(coverage({ quantity: 1.2, claims: [{ guestId: "a", quantity: 0.6 }] })).toEqual({ promised: 0.6, missing: 0.6, covered: false });
    expect(coverage({ quantity: 1.2, claims: [{ guestId: "a", quantity: 0.6 }, { guestId: "b", quantity: 0.6 }] }).covered).toBe(true);
    expect(coverage({ quantity: 1.2, claims: [{ guestId: "a", quantity: null }] }).covered).toBe(true);
    expect(coverage({ quantity: null, claims: [] }).covered).toBe(false);
    expect(coverage({ quantity: null, claims: [{ guestId: "a", quantity: null }] }).covered).toBe(true);
  });

  it("« je ramène tout » takes the rest, and the feast gauge counts covered lines", () => {
    const line = { quantity: 3, claims: [{ guestId: "a", quantity: 1 }, { guestId: "b", quantity: 0.5 }] };
    expect(restOf(line, "c")).toBe(1.5);
    expect(restOf(line, "a")).toBe(2.5); // a's own part counts again: they take the rest instead
    expect(restOf({ quantity: null, claims: [] }, "a")).toBeNull();
    expect(feast([line, { quantity: null, claims: [{ guestId: "a", quantity: null }] }])).toBe(50);
  });

  it("says amounts the French way", () => {
    expect(amount(1.2, "kg")).toBe("1,2 kg");
    expect(amount(3, "bouteille")).toBe("3 bouteilles");
    expect(amount(1, "bocal")).toBe("1 bocal");
    expect(amount(null, "kg")).toBe("");
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("0")).toBeNull();
  });
});
