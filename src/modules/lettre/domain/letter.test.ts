import { describe, expect, it } from "vitest";
import {
  byWish,
  cleanName,
  euros,
  frenchSpaces,
  giftCount,
  isTaken,
  joinNames,
  letterTitle,
  offerSentence,
  parseEuros,
  participation,
  pledgeError,
  progressOf,
  siteOf,
  stageOf,
  untaken,
  wellReceived,
} from "./letter";

describe("letterTitle", () => {
  it("elides before a vowel or an h, not before a consonant", () => {
    expect(letterTitle("Arès", 2026)).toBe("Lettre au Père Noël d'Arès 2026");
    expect(letterTitle("Hugo", 2027)).toBe("Lettre au Père Noël d'Hugo 2027");
    expect(letterTitle("Léon", 2026)).toBe("Lettre au Père Noël de Léon 2026");
  });
});

describe("stageOf", () => {
  const day = new Date("2026-12-01T10:00:00Z");
  it("goes from preparation to shared to closed", () => {
    expect(stageOf({ sharedAt: null, closedAt: null })).toBe("preparation");
    expect(stageOf({ sharedAt: day, closedAt: null })).toBe("shared");
    expect(stageOf({ sharedAt: day, closedAt: day })).toBe("closed");
  });
});

describe("progressOf", () => {
  it("a gift for one person is full once someone gives it", () => {
    expect(progressOf({ pot: false, copies: 1, priceCents: 3500 }, [])).toEqual({ kind: "gift", taken: 0, limit: 1, full: false });
    expect(progressOf({ pot: false, copies: 1, priceCents: 3500 }, [{ amountCents: null }])).toMatchObject({ taken: 1, full: true });
  });

  it("a gift several people can give fills up to its number, or never", () => {
    const three = { pot: false, copies: 3, priceCents: null };
    expect(progressOf(three, [{ amountCents: null }, { amountCents: null }]).full).toBe(false);
    expect(progressOf(three, [{ amountCents: null }, { amountCents: null }, { amountCents: null }]).full).toBe(true);
    expect(progressOf({ pot: false, copies: null, priceCents: null }, Array(25).fill({ amountCents: null })).full).toBe(false);
  });

  it("a cagnotte adds up the promises against its amount", () => {
    const bike = { pot: true, copies: 1, priceCents: 20000 };
    expect(progressOf(bike, [])).toEqual({ kind: "pot", totalCents: 0, targetCents: 20000, remainingCents: 20000, percent: 0, full: false });
    expect(progressOf(bike, [{ amountCents: 5000 }, { amountCents: 3000 }])).toEqual({ kind: "pot", totalCents: 8000, targetCents: 20000, remainingCents: 12000, percent: 40, full: false });
    expect(progressOf(bike, [{ amountCents: 15000 }, { amountCents: 5000 }])).toMatchObject({ remainingCents: 0, percent: 100, full: true });
  });

  it("a cagnotte whose amount was lowered under the promises stays full, at 100 %", () => {
    expect(progressOf({ pot: true, copies: 1, priceCents: 10000 }, [{ amountCents: 15000 }])).toMatchObject({ remainingCents: 0, percent: 100, full: true });
  });

  it("rounds the gauge down: 99.9 % is not done", () => {
    expect(progressOf({ pot: true, copies: 1, priceCents: 100000 }, [{ amountCents: 99900 }])).toMatchObject({ percent: 99, full: false });
  });
});

describe("pledgeError", () => {
  it("accepts any amount up to what's left", () => {
    expect(pledgeError(3000, 12000)).toBeNull();
    expect(pledgeError(12000, 12000)).toBeNull();
  });

  it("refuses more than what's left, and says how much is", () => {
    expect(pledgeError(5000, 2000)).toBe("Il ne manque plus que 20 € : vous pouvez promettre ce montant au plus.");
  });

  it("refuses nothing, cents below a euro, and a full cagnotte", () => {
    expect(pledgeError(null, 2000)).toMatch(/au moins 1 €/);
    expect(pledgeError(50, 2000)).toMatch(/au moins 1 €/);
    expect(pledgeError(12.5, 2000)).toMatch(/au moins 1 €/);
    expect(pledgeError(1000, 0)).toBe("La cagnotte est déjà complète. Merci !");
  });
});

describe("euros and parseEuros", () => {
  it("writes whole amounts without cents", () => {
    expect(euros(3500).replace(/\s/g, " ")).toBe("35 €");
    expect(euros(3550).replace(/\s/g, " ")).toBe("35,50 €");
    expect(euros(129900).replace(/\s/g, " ")).toBe("1 299 €");
  });

  it.each([
    ["35", 3500],
    ["35,5", 3550],
    ["35.50 €", 3550],
    [" 1 200 ", 120000],
  ] as const)("reads %s", (text, cents) => {
    expect(parseEuros(text)).toBe(cents);
  });

  it.each(["", "abc", "-5", "0", "12,345", "1000000"])("refuses %s", (text) => {
    expect(parseEuros(text)).toBeNull();
  });
});

describe("byWish", () => {
  it("puts the favourites first, then keeps the order they were added in", () => {
    const at = (s: number) => new Date(2026, 10, 15, 10, 0, s);
    const gifts = [
      { id: "puzzle", favorite: false, createdAt: at(1) },
      { id: "bike", favorite: true, createdAt: at(3) },
      { id: "book", favorite: false, createdAt: at(0) },
      { id: "lego", favorite: true, createdAt: at(2) },
    ];
    expect([...gifts].sort(byWish).map((g) => g.id)).toEqual(["lego", "bike", "book", "puzzle"]);
  });
});

describe("untaken", () => {
  it("keeps the gifts nobody gave nor promised anything for", () => {
    const gifts = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(untaken(gifts, [{ giftId: "b" }, { giftId: "b" }])).toEqual([{ id: "a" }, { id: "c" }]);
  });
});

describe("offerSentence", () => {
  const base = { name: "Claire", giftTitle: "Draisienne", childName: "Arès" };
  const plain = (s: string) => s.replace(/\s/g, " ");
  it("tells a gift, a promise, and taking either back", () => {
    expect(offerSentence({ ...base, type: "offer", amountCents: null })).toBe("Claire offre « Draisienne » à Arès.");
    expect(offerSentence({ ...base, type: "withdraw", amountCents: null })).toBe("Claire n'offre plus « Draisienne » : quelqu'un d'autre peut l'offrir.");
    expect(plain(offerSentence({ ...base, type: "offer", amountCents: 3000 }))).toBe("Claire promet 30 € pour la cagnotte « Draisienne ».");
    expect(plain(offerSentence({ ...base, type: "withdraw", amountCents: 3000 }))).toBe("Claire retire sa part de 30 € de la cagnotte « Draisienne ».");
  });

  it("says which organizer noted it or took it back, so the others don't think the person did", () => {
    expect(offerSentence({ ...base, type: "offer", amountCents: null, by: "Hugo" })).toBe("Claire offre « Draisienne » à Arès (noté par Hugo).");
    expect(plain(offerSentence({ ...base, type: "offer", amountCents: 3000, by: "Hugo" }))).toBe("Claire promet 30 € pour la cagnotte « Draisienne » (noté par Hugo).");
    expect(offerSentence({ ...base, type: "withdraw", amountCents: null, by: "Hugo" })).toBe("Hugo a libéré « Draisienne », que Claire offrait.");
    expect(offerSentence({ ...base, name: "Inès", type: "withdraw", amountCents: null, by: "Hugo" })).toBe("Hugo a libéré « Draisienne », qu'Inès offrait.");
    expect(plain(offerSentence({ ...base, name: "Inès", type: "withdraw", amountCents: 3000, by: "Hugo" }))).toBe("Hugo a retiré la part d'Inès (30 €) de la cagnotte « Draisienne ».");
  });
});

describe("giftCount", () => {
  it("writes the plural out: never « cadeaus »", () => {
    expect(giftCount(0)).toBe("aucun cadeau");
    expect(giftCount(1)).toBe("1 cadeau");
    expect(giftCount(2)).toBe("2 cadeaux");
    expect(giftCount(11)).toBe("11 cadeaux");
  });
});

describe("isTaken", () => {
  it("counts a gift once someone gives it, a cagnotte only once it's complete", () => {
    expect(isTaken({ pot: false, full: false, offers: [] })).toBe(false);
    expect(isTaken({ pot: false, full: false, offers: [{}] })).toBe(true); // books: one given, more welcome
    expect(isTaken({ pot: true, full: false, offers: [{}] })).toBe(false);
    expect(isTaken({ pot: true, full: true, offers: [{}] })).toBe(true);
  });
});

describe("joinNames and participation", () => {
  it("joins names the French way, each once", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Claire"])).toBe("Claire");
    expect(joinNames(["Claire", "Hugo"])).toBe("Claire et Hugo");
    expect(joinNames(["Claire", "Inès", "Claire", "Hugo"])).toBe("Claire, Inès et Hugo");
  });

  it("says « votre participation » to its author, and « de »/« d' » before each name", () => {
    expect(participation([])).toBeNull();
    expect(participation([{ name: "Inès", mine: true }])).toBe("Avec votre participation.");
    expect(participation([{ name: "Inès", mine: true }, { name: "Hugo", mine: false }])).toBe("Avec votre participation et celle d'Hugo.");
    expect(participation([{ name: "Hugo", mine: false }, { name: "Inès", mine: true }, { name: "Claire", mine: false }])).toBe("Avec votre participation et celles d'Hugo et de Claire.");
    expect(participation([{ name: "Claire", mine: false }, { name: "Inès", mine: false }, { name: "Hugo", mine: false }])).toBe("Avec la participation de Claire, d'Inès et d'Hugo.");
  });

  it("agrees « reçu » with the amount: the plural starts at 2 €", () => {
    expect(wellReceived(3000)).toBe("bien reçus");
    expect(wellReceived(200)).toBe("bien reçus");
    expect(wellReceived(150)).toBe("bien reçu");
  });
});

describe("frenchSpaces", () => {
  it("binds the punctuation to its word, and leaves the rest alone", () => {
    expect(frenchSpaces("Merci à tous ! Tu viens ? « Oui » : bien ; ok!")).toBe("Merci à tous ! Tu viens ? « Oui » : bien ; ok!");
    expect(frenchSpaces("Cher Père Noël,\nvoici ma liste")).toBe("Cher Père Noël,\nvoici ma liste");
  });

  it("keeps a phone number and a big amount on one line", () => {
    expect(frenchSpaces("Par Wero au 06 12 34 56 78")).toBe("Par Wero au 06 12 34 56 78");
    expect(frenchSpaces("1 200 € pour 3 livres")).toBe("1 200 € pour 3 livres");
  });
});

describe("cleanName and siteOf", () => {
  it("tidies a typed first name", () => {
    expect(cleanName("  Claire   Marie ")).toBe("Claire Marie");
  });

  it("names the shop of a link", () => {
    expect(siteOf("https://www.fnac.com/a123/draisienne")).toBe("fnac.com");
    expect(siteOf("http://jouets.example.org/x")).toBe("jouets.example.org");
    expect(siteOf("pas un lien")).toBe("pas un lien");
  });
});
