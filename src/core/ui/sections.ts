/**
 * The club's sections (docs/01-produit.md §2/§3) — shared between the home
 * page's discovery grid and the header's quick-switch dropdown, so a new
 * section only needs to be listed once.
 */
export interface ClubSection {
  name: string;
  description: string;
  href: string | null;
  live: boolean;
}

export const CLUB_SECTIONS: ClubSection[] = [
  {
    name: "Prêtothèque",
    description: "Le matériel du club, réservable en deux clics.",
    href: "/pretotheque",
    live: true,
  },
  {
    name: "Les menus du club",
    description: "Organiser un repas de groupe — qui vient, qui apporte quoi.",
    href: "/menus",
    live: true,
  },
  {
    name: "L'agenda en commun",
    description: "Les jours et week-ends où tout le monde est libre, en un coup d'œil.",
    href: "/agenda",
    live: true,
  },
  {
    name: "Caisse commune",
    description: "Suivre les dépenses partagées du club.",
    href: "/caisse",
    live: true,
  },
  {
    name: "Nos recettes",
    description: "Le livre de recettes du club, à plusieurs mains.",
    href: null,
    live: false,
  },
];
