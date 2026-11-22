/**
 * The calculator: a meal's usual shopping list, per person, from the number of végés and non-végés.
 * A starting point, never the truth: the organizer adjusts it. Quantities are what a hungry table eats
 * (raclette: about 200 g of cheese and 300 g of potatoes a head).
 */
import type { Category } from "./list";

export interface TemplateLine {
  label: string;
  emoji: string;
  category: Category;
  /** Who eats it: everyone, the non-végés, the végés. */
  for: "all" | "meat" | "vege";
  /** An amount per person… */
  perPerson?: number;
  /** …or one unit for this many people (a jar of gherkins for 8). */
  onePer?: number;
  unit: string;
  /** Rounded up to this step (50 g, 1 jar). */
  step: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  emoji: string;
  lines: TemplateLine[];
}

const g = (label: string, emoji: string, perPerson: number, forWho: TemplateLine["for"] = "all", category: Category = "manger"): TemplateLine => ({ label, emoji, category, for: forWho, perPerson, unit: "g", step: 50 });
const one = (label: string, emoji: string, onePer: number, unit: string, category: Category = "manger", forWho: TemplateLine["for"] = "all"): TemplateLine => ({ label, emoji, category, for: forWho, onePer, unit, step: 1 });
const each = (label: string, emoji: string, perPerson: number, unit: string, category: Category = "manger", forWho: TemplateLine["for"] = "all"): TemplateLine => ({ label, emoji, category, for: forWho, perPerson, unit, step: 1 });

export const TEMPLATES: MealTemplate[] = [
  {
    id: "raclette",
    name: "Raclette",
    emoji: "🧀",
    lines: [
      g("Fromage à raclette", "🧀", 200),
      g("Pommes de terre", "🥔", 300),
      g("Charcuterie", "🥓", 120, "meat"),
      g("Champignons et légumes à griller", "🍄", 150, "vege"),
      one("Cornichons", "🥒", 8, "bocal"),
      one("Oignons grelots", "🧅", 10, "bocal"),
      one("Salade verte", "🥬", 6, "salade"),
      one("Pain", "🥖", 5, "baguette"),
      one("Vin blanc", "🍷", 3, "bouteille", "boire"),
      one("Appareil à raclette", "🔥", 8, "appareil", "materiel"),
    ],
  },
  {
    id: "fondue",
    name: "Fondue savoyarde",
    emoji: "🫕",
    lines: [
      g("Fromages à fondue (comté, beaufort, emmental)", "🧀", 250),
      one("Pain de campagne", "🥖", 3, "pain"),
      g("Charcuterie", "🥓", 100, "meat"),
      g("Légumes à tremper", "🥦", 100, "vege"),
      one("Salade verte", "🥬", 6, "salade"),
      one("Vin blanc", "🍷", 3, "bouteille", "boire"),
      one("Caquelon et réchaud", "🔥", 6, "caquelon", "materiel"),
    ],
  },
  {
    id: "tartiflette",
    name: "Tartiflette",
    emoji: "🥘",
    lines: [
      one("Reblochon", "🧀", 4, "reblochon"),
      g("Pommes de terre", "🥔", 300),
      g("Lardons", "🥓", 80, "meat"),
      g("Champignons", "🍄", 80, "vege"),
      one("Oignons", "🧅", 4, "oignon"),
      one("Crème fraîche (20 cl)", "🥛", 6, "pot"),
      one("Salade verte", "🥬", 6, "salade"),
      one("Vin blanc", "🍷", 3, "bouteille", "boire"),
    ],
  },
  {
    id: "crepes",
    name: "Crêpes",
    emoji: "🥞",
    lines: [
      g("Farine", "🌾", 60),
      each("Œufs", "🥚", 0.5, "œuf"),
      each("Lait", "🥛", 0.15, "L"),
      one("Beurre", "🧈", 8, "plaquette"),
      g("Jambon", "🥓", 50, "meat"),
      g("Fromage râpé", "🧀", 40),
      g("Champignons", "🍄", 60, "vege"),
      one("Pâte à tartiner", "🍫", 8, "pot"),
      one("Cidre", "🍾", 3, "bouteille", "boire"),
      one("Crêpière ou bilig", "🍳", 8, "crêpière", "materiel"),
    ],
  },
  {
    id: "barbecue",
    name: "Barbecue",
    emoji: "🍖",
    lines: [
      each("Saucisses et merguez", "🌭", 2, "pièce", "manger", "meat"),
      each("Brochettes de légumes", "🍢", 2, "brochette", "manger", "vege"),
      g("Salade composée", "🥗", 150),
      one("Chips", "🥔", 5, "paquet"),
      one("Pain", "🥖", 4, "baguette"),
      one("Sauces (ketchup, moutarde…)", "🥫", 10, "lot"),
      each("Bières", "🍺", 2, "bière", "boire"),
      one("Charbon de bois", "🔥", 10, "sac", "materiel"),
    ],
  },
  {
    id: "apero",
    name: "Apéro dînatoire",
    emoji: "🥂",
    lines: [
      one("Chips et biscuits apéro", "🥨", 4, "paquet"),
      g("Légumes à croquer", "🥕", 100),
      one("Houmous et tartinades", "🫙", 6, "pot"),
      g("Fromages", "🧀", 80),
      g("Charcuterie", "🥓", 80, "meat"),
      one("Pain et crackers", "🥖", 4, "baguette"),
      one("Vin", "🍷", 3, "bouteille", "boire"),
      each("Bières ou softs", "🥤", 1, "boisson", "boire"),
    ],
  },
  {
    id: "pizzas",
    name: "Pizzas maison",
    emoji: "🍕",
    lines: [
      each("Pâtes à pizza", "🍕", 0.5, "pâte"),
      one("Sauce tomate", "🍅", 4, "pot"),
      one("Mozzarella", "🧀", 3, "boule"),
      g("Jambon ou chorizo", "🥓", 50, "meat"),
      g("Légumes (poivrons, champignons, olives)", "🫑", 100, "vege"),
      one("Salade verte", "🥬", 6, "salade"),
      each("Bières ou softs", "🥤", 1, "boisson", "boire"),
    ],
  },
];

export const templateOf = (id: string | null | undefined) => TEMPLATES.find((t) => t.id === id) ?? null;

export interface Proposal {
  label: string;
  emoji: string;
  category: Category;
  quantity: number;
  unit: string;
}

/** The list for this table: every line for the people who eat it, rounded up; grams above a kilo become kilos. */
export function proposeList(t: MealTemplate, counts: { vege: number; meat: number }): Proposal[] {
  const vege = Math.max(0, Math.floor(counts.vege));
  const meat = Math.max(0, Math.floor(counts.meat));
  const out: Proposal[] = [];
  for (const line of t.lines) {
    const people = line.for === "all" ? vege + meat : line.for === "vege" ? vege : meat;
    if (people === 0) continue;
    const raw = line.perPerson !== undefined ? line.perPerson * people : people / (line.onePer ?? 1);
    let quantity = Math.max(line.step, Math.ceil(raw / line.step - 1e-9) * line.step);
    let unit = line.unit;
    if (unit === "g" && quantity >= 1000) {
      quantity = Math.ceil(quantity / 100) / 10;
      unit = "kg";
    }
    if (unit === "L") quantity = Math.ceil(raw * 2) / 2;
    out.push({ label: line.label, emoji: line.emoji, category: line.category, quantity: round2(quantity), unit });
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
