import { eventDays, type Rule, type Split } from "./plan";

/**
 * What a first New Year starts with, from the old spreadsheet (« NYE 2026 ») — everything can be
 * changed, added, taken away. The drinks' ratios come from the gîte years: about 18 people over two
 * days drank some 120 beers, 8 bottles of red, 6 of crémant for the punch and 3 of champagne at
 * midnight, which is what « 3,5 bières par personne et par jour » means.
 */

export interface TemplateItem {
  name: string;
  rule: Rule;
  ratio: number;
  unit: string;
  perPack: number;
  /** The price of what one buys (the pack, the bottle), in cents. */
  packPriceCents: number | null;
}

export interface TemplateList {
  name: string;
  split: Exclude<Split, "options">;
  items: TemplateItem[];
}

const i = (name: string, rule: Rule, ratio: number, unit: string, perPack: number, packPriceCents: number | null): TemplateItem => ({ name, rule, ratio, unit, perPack, packPriceCents });

export const TEMPLATE_LISTS: TemplateList[] = [
  {
    name: "Boissons",
    split: "presence",
    items: [
      i("Bières", "person_day", 3.5, "canette 25 cl", 20, 1029),
      i("Bières sans alcool", "person_day", 0.6, "canette 25 cl", 6, 408),
      i("Vin rouge", "person_day", 0.25, "bouteille 75 cl", 1, 400),
      i("Vin blanc", "person_day", 0.1, "bouteille 75 cl", 1, 400),
      i("Rosé", "person_day", 0.1, "bouteille 75 cl", 1, 400),
      i("Crémant (soupe champenoise)", "person", 0.33, "bouteille 75 cl", 1, 500),
      i("Champagne (minuit)", "person", 0.17, "bouteille 75 cl", 1, 2200),
      i("Cointreau", "fixed", 1, "bouteille 70 cl", 1, 1850),
      i("Sirop de sucre de canne", "fixed", 1, "bouteille 75 cl", 1, 165),
      i("Cidre", "person_day", 0.08, "bouteille 75 cl", 1, 179),
      i("Coca", "person_day", 0.06, "bouteille 1,75 L", 1, 236),
      i("Coca zéro", "person_day", 0.06, "bouteille 1,75 L", 1, 169),
      i("Ice tea", "person_day", 0.15, "bouteille 1,5 L", 1, 116),
      i("Jus d'orange", "person_day", 0.11, "brique 1 L", 1, 175),
      i("Jus de pomme", "person_day", 0.11, "brique 1 L", 1, 95),
      i("Eau plate", "person_day", 0.5, "bouteille 1,5 L", 6, 108),
      i("Eau pétillante", "person_day", 0.17, "bouteille 1,5 L", 6, 384),
      i("Café moulu", "person_day", 0.2, "paquet 250 g", 4, 700),
      i("Thé", "fixed", 1, "boîte", 1, 160),
    ],
  },
  {
    name: "Courses",
    split: "presence",
    items: [
      i("Essuie-tout", "person_day", 0.05, "rouleau", 1, 361),
      i("Sacs poubelle 50 L", "fixed", 1, "rouleau", 1, 194),
      i("Papier alu", "fixed", 1, "rouleau", 1, 223),
      i("Film étirable", "fixed", 1, "rouleau", 1, 115),
      i("Éponges", "fixed", 1, "lot", 1, 186),
      i("Liquide vaisselle", "fixed", 1, "flacon", 1, 150),
    ],
  },
  {
    name: "Matos et déco",
    split: "equal",
    items: [
      i("Gobelets", "person_day", 3, "gobelet", 50, 450),
      i("Couverts jetables", "person_meal", 1, "set", 50, 600),
      i("Serviettes", "person_meal", 1, "serviette", 100, 300),
      i("Pailles", "fixed", 1, "paquet", 1, 200),
      i("Nappes", "fixed", 4, "nappe", 1, 300),
      i("Ballons doré et noir", "fixed", 1, "sachet", 1, 600),
      i("Confettis", "fixed", 1, "sachet", 1, 300),
      i("Bougies", "fixed", 1, "lot", 1, 500),
    ],
  },
];

/** The budget lines that aren't lists: estimates to fill in, and how each is shared. */
export const TEMPLATE_COSTS: { label: string; split: Split }[] = [
  { label: "Le lieu", split: "options" },
  { label: "Sono et lumières", split: "equal" },
  { label: "Jeux et activités", split: "equal" },
];

/** Who does what, from the old organization chart: its poles and missions, nobody assigned yet. */
export const TEMPLATE_TASKS: { pole: string; title: string; due: string }[] = [
  { pole: "Coordination", title: "Répartition et suivi des préparatifs", due: "" },
  { pole: "Coordination", title: "Gestion du budget", due: "ASAP" },
  { pole: "Dormir / venir", title: "Le lieu : réservation et paiement", due: "" },
  { pole: "Dormir / venir", title: "Répartition des chambres", due: "20 novembre" },
  { pole: "Manger / boire", title: "Recensement des convives (régimes, allergies)", due: "20 novembre" },
  { pole: "Manger / boire", title: "Élaboration des menus", due: "20 novembre" },
  { pole: "Manger / boire", title: "Courses alimentaires", due: "Dernière minute" },
  { pole: "Manger / boire", title: "Courses boissons", due: "18 décembre" },
  { pole: "Fun", title: "Sono : trouver, récupérer, rendre", due: "20 novembre" },
  { pole: "Fun", title: "Lumières : trouver, récupérer, rendre", due: "20 novembre" },
  { pole: "Fun", title: "Décoration : acheter, installer, ranger", due: "18 décembre" },
  { pole: "Fun", title: "Playlist", due: "Dernière minute" },
  { pole: "Fun", title: "Programme de jeux et activités", due: "18 décembre" },
  { pole: "Ménage", title: "Ménage de la salle", due: "" },
];

/** The meals of a stay: the evening of the first day, lunch and dinner in between, lunch on the last. */
export function templateMeals(startsOn: string, endsOn: string): { day: string; label: string }[] {
  const days = eventDays(startsOn, endsOn);
  if (days.length === 1) return [{ day: days[0]!, label: "Soir" }];
  return days.flatMap((day, n) => (n === 0 ? [{ day, label: "Soir" }] : n === days.length - 1 ? [{ day, label: "Midi" }] : [{ day, label: "Midi" }, { day, label: "Soir" }]));
}

/** « Nouvel an 2025 » → « Nouvel an 2026 »; a title without a year gets next year's. */
export function nextTitle(title: string, year: number): string {
  return /\b20\d\d\b/.test(title) ? title.replace(/\b(20\d\d)\b/, (y) => String(Number(y) + 1)) : `${title} ${year}`.trim();
}

/** The next New Year's dates: the 31st of December to the 1st of January, after `today`. */
export function nextNewYear(today: string): { startsOn: string; endsOn: string; year: number } {
  // The 31st of December of this year is always still to come (or today).
  const year = Number(today.slice(0, 4));
  return { startsOn: `${year}-12-31`, endsOn: `${year + 1}-01-01`, year };
}
