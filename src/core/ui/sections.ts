/**
 * The club's sections (docs/01-produit.md §2/§3) — shared between the home page, the header's
 * quick-switch, the phone's shortcut bar and each section's title, so a new section only needs to
 * be listed once. Each has its colour and its icon: the same tile everywhere it appears.
 */
export type SectionId = "pretotheque" | "repas" | "agenda" | "caisse" | "recettes" | "jeux" | "dons";

export interface ClubSection {
  id: SectionId;
  name: string;
  /** In the phone's shortcut bar and other tight spots. */
  short: string;
  description: string;
  href: string | null;
  live: boolean;
  /** The tile's colour, and the ink that reads on it. */
  color: string;
  ink: string;
  /** Activity feed entries tagged with this `section` belong here (the meals still log as « menus »). */
  activity: string[];
}

export const CLUB_SECTIONS: ClubSection[] = [
  {
    id: "pretotheque",
    name: "Prêtothèque",
    short: "Prêts",
    description: "Le matériel du club, réservable en deux clics.",
    href: "/pretotheque",
    live: true,
    color: "#ff7a29",
    ink: "#1a0a00",
    activity: ["pretotheque"],
  },
  {
    id: "repas",
    name: "Les repas du CLHUB",
    short: "Repas",
    description: "Une raclette, un barbecue : qui vient, qui ramène quoi, et la liste de courses.",
    href: "/repas",
    live: true,
    color: "#39ffb0",
    ink: "#06140d",
    activity: ["menus", "repas"],
  },
  {
    id: "agenda",
    name: "L'agenda en commun",
    short: "Agenda",
    description: "Les jours et week-ends où tout le monde est libre, en un coup d'œil.",
    href: "/agenda",
    live: true,
    color: "#c04dff",
    ink: "#12001a",
    activity: ["agenda"],
  },
  {
    id: "caisse",
    name: "Caisse commune",
    short: "Caisse",
    description: "Suivre les dépenses partagées du club.",
    href: "/caisse",
    live: true,
    color: "#29e0ff",
    ink: "#001a20",
    activity: ["caisse"],
  },
  {
    id: "recettes",
    name: "Nos recettes",
    short: "Recettes",
    description: "Le livre de recettes du club, à plusieurs mains.",
    href: "/recettes",
    live: true,
    color: "#baff29",
    ink: "#121a00",
    activity: ["recettes"],
  },
  {
    id: "jeux",
    name: "Jeux",
    short: "Jeux",
    description: "Compteur de points, dés, buzzer, Loups-garous, Secret Santa et autres soirées.",
    href: "/jeux",
    live: true,
    color: "#ffcc29",
    ink: "#1a1400",
    activity: ["jeux", "loups"],
  },
  {
    id: "dons",
    name: "Cabanes à dons",
    short: "Dons",
    description: "Dons, troc et petites ventes entre membres.",
    href: "/dons",
    live: true,
    color: "#ff3ec9",
    ink: "#1a0512",
    activity: ["dons"],
  },
];

export const sectionById = (id: SectionId) => CLUB_SECTIONS.find((s) => s.id === id)!;

/** The section an activity entry belongs to, if any (« club » entries belong to none). */
export const sectionOfActivity = (section: string) => CLUB_SECTIONS.find((s) => s.activity.includes(section)) ?? null;

/** The phone's shortcut bar: the sections reached most, the rest behind « Tout ». */
export const SHORTCUTS: SectionId[] = ["pretotheque", "repas", "agenda", "jeux"];
