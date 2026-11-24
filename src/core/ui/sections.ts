/**
 * The club in five verbs (Arthur, 24/11/2026): Partager, Manger, Se retrouver, Jouer, Célébrer. Each
 * pole has its colour and its page; its modules (the Prêtothèque, the potlucks…) share its colour
 * and keep their own icon. Listed once here for the phone's bar, the header, the home page and
 * each page's title.
 */
export type PoleId = "partager" | "manger" | "retrouver" | "jouer" | "celebrer";
export type SectionId = "pretotheque" | "dons" | "repas" | "recettes" | "agenda" | "caisse" | "jeux" | "santa" | "lettre";

export interface Pole {
  id: PoleId;
  /** The verb, as on the bar. */
  name: string;
  href: string;
  /** One line under the verb on its page and the home page. */
  tagline: string;
  color: string;
  ink: string;
  icon: SectionId | PoleId;
  /** Shortcuts under the verb in the header's menu, when they aren't simply its modules. */
  links?: { label: string; href: string }[];
}

export interface ClubSection {
  id: SectionId;
  pole: PoleId;
  name: string;
  /** In tight spots and in the feed. */
  short: string;
  description: string;
  href: string | null;
  live: boolean;
  color: string;
  ink: string;
  /** Activity feed entries tagged with this `section` belong here (the potlucks still log as « menus »). */
  activity: string[];
  /** The one thing people come to do, on its pole's page. */
  action?: { label: string; href: string };
}

export const POLES: Pole[] = [
  { id: "partager", name: "Partager", href: "/partager", tagline: "Prêter son matériel, donner ce qui ne sert plus.", color: "#ff7a29", ink: "#1a0a00", icon: "partager" },
  { id: "manger", name: "Manger", href: "/manger", tagline: "Les potlucks, et les recettes du club.", color: "#39ffb0", ink: "#06140d", icon: "repas" },
  { id: "retrouver", name: "Se retrouver", href: "/se-retrouver", tagline: "Trouver la date, partager les frais.", color: "#c04dff", ink: "#12001a", icon: "agenda" },
  { id: "jouer", name: "Jouer", href: "/jouer", tagline: "Les grands jeux et les outils des soirées.", color: "#ffcc29", ink: "#1a1400", icon: "jeux", links: [
    { label: "Loups-garous", href: "/jeux/loups" },
    { label: "Killer", href: "/jeux/killer" },
    { label: "Dés", href: "/jeux/des" },
    { label: "Points", href: "/jeux/points" },
    { label: "Buzzer", href: "/jeux/buzzer" },
  ] },
  { id: "celebrer", name: "Célébrer", href: "/celebrer", tagline: "Les fêtes du club : le Secret Santa, la lettre au Père Noël des enfants.", color: "#ff3ec9", ink: "#1a0512", icon: "celebrer" },
];

export const poleById = (id: PoleId) => POLES.find((p) => p.id === id)!;
const tint = (pole: PoleId) => ({ color: poleById(pole).color, ink: poleById(pole).ink });

export const CLUB_SECTIONS: ClubSection[] = [
  { id: "pretotheque", pole: "partager", name: "Prêtothèque", short: "Prêts", description: "Le matériel du club, réservable en deux clics.", href: "/pretotheque", live: true, ...tint("partager"), action: { label: "Ajouter un objet", href: "/pretotheque/new" }, activity: ["pretotheque"] },
  { id: "dons", pole: "partager", name: "Cabanes à dons", short: "Dons", description: "Dons, troc et petites ventes entre membres.", href: "/dons", live: true, ...tint("partager"), action: { label: "Proposer un objet", href: "/dons/new" }, activity: ["dons"] },
  { id: "repas", pole: "manger", name: "Les potlucks du CLHUB", short: "Potlucks", description: "Une raclette, un barbecue : qui vient, qui ramène quoi, et la liste de courses.", href: "/repas", live: true, ...tint("manger"), action: { label: "Organiser un potluck", href: "/repas/nouveau" }, activity: ["menus", "repas"] },
  { id: "recettes", pole: "manger", name: "Nos recettes", short: "Recettes", description: "Le livre de recettes du club, à plusieurs mains.", href: "/recettes", live: true, ...tint("manger"), action: { label: "Proposer une recette", href: "/recettes/new" }, activity: ["recettes"] },
  { id: "agenda", pole: "retrouver", name: "L'agenda en commun", short: "Agenda", description: "Les jours et week-ends où tout le monde est libre, en un coup d'œil.", href: "/agenda", live: true, ...tint("retrouver"), action: { label: "Ajouter un évènement", href: "/agenda/new" }, activity: ["agenda"] },
  { id: "caisse", pole: "retrouver", name: "Caisse commune", short: "Caisse", description: "Les dépenses partagées d'un week-end ou d'une sortie : qui doit quoi à qui.", href: "/caisse", live: true, ...tint("retrouver"), action: { label: "Nouvel évènement", href: "/caisse/new" }, activity: ["caisse"] },
  { id: "jeux", pole: "jouer", name: "Jeux", short: "Jeux", description: "Loups-garous, Killer, dés, compteur de points, buzzer.", href: "/jouer", live: true, ...tint("jouer"), activity: ["jeux", "loups", "killer"] },
  { id: "santa", pole: "celebrer", name: "Secret Santa", short: "Secret Santa", description: "Le tirage au sort des cadeaux, un lien perso pour chacun.", href: "/jeux/santa", live: true, ...tint("celebrer"), activity: ["santa"] },
  { id: "lettre", pole: "celebrer", name: "Ma lettre au Père Noël", short: "Lettre", description: "La liste d'un enfant pour toute la famille, et une cagnotte.", href: "/jeux/lettre", live: true, ...tint("celebrer"), activity: ["lettre"] },
];

export const sectionById = (id: SectionId) => CLUB_SECTIONS.find((s) => s.id === id)!;

/** The module an activity entry belongs to, if any (« club » entries belong to none). */
export const sectionOfActivity = (section: string) => CLUB_SECTIONS.find((s) => s.activity.includes(section)) ?? null;

/** The pole a path belongs to: its own page, or one of its modules' pages. */
export function poleOfPath(pathname: string): PoleId | null {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  for (const p of POLES) if (under(p.href)) return p.id;
  // The games' pages live under /jeux; the Christmas ones belong to Célébrer.
  if (under("/jeux/santa") || under("/jeux/lettre")) return "celebrer";
  if (under("/jeux")) return "jouer";
  for (const s of CLUB_SECTIONS) if (s.href && under(s.href)) return s.pole;
  return null;
}
