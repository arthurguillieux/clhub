/**
 * The cards of « Loups-garous »: who they are, which side they play for, and a short rule in our own
 * words (a meneur can rewrite any of them for their table, see `wolf_rule`).
 */

export type Camp = "village" | "loups" | "solo";

export interface RoleCard {
  id: string;
  name: string;
  camp: Camp;
  rule: string;
}

/** In Arthur's order: the wolves, then the cards of his usual table, then all the others. */
export const ROLES = [
  {
    id: "loup",
    name: "Loup-garou",
    camp: "loups",
    rule: "Chaque nuit, les loups-garous se réveillent ensemble et choisissent une victime. Le jour, ils se font passer pour de simples villageois. Ils gagnent quand il ne reste plus que des loups.",
  },
  {
    id: "enfant",
    name: "Enfant sauvage",
    camp: "village",
    rule: "La première nuit, il choisit en secret un modèle. Tant que son modèle vit, il est villageois. Si le modèle meurt, il devient loup-garou et rejoint la meute.",
  },
  {
    id: "vv",
    name: "Villageois-villageois",
    camp: "village",
    rule: "Sa carte a deux faces identiques : tout le monde sait qu'il est innocent. Pas de pouvoir, mais une parole à laquelle on peut se fier.",
  },
  {
    id: "villageois",
    name: "Simple villageois",
    camp: "village",
    rule: "Aucun pouvoir : seulement son vote et son flair. Il gagne avec le village quand tous les loups sont morts.",
  },
  {
    id: "ancien",
    name: "Ancien",
    camp: "village",
    rule: "Il résiste à la première attaque des loups-garous et ne meurt qu'à la deuxième. Mais si c'est le village qui le tue (vote, sorcière, chasseur…), les villageois perdent tous leurs pouvoirs.",
  },
  {
    id: "cupidon",
    name: "Cupidon",
    camp: "village",
    rule: "La première nuit, il désigne deux joueurs qui tombent amoureux (il peut se choisir). Si l'un meurt, l'autre meurt de chagrin. Si les amoureux sont dans deux camps différents, ils forment un troisième camp et gagnent en étant les deux derniers en vie.",
  },
  {
    id: "salvateur",
    name: "Salvateur",
    camp: "village",
    rule: "Chaque nuit, il protège un joueur de l'attaque des loups, lui-même compris, mais jamais le même deux nuits de suite.",
  },
  {
    id: "sorciere",
    name: "Sorcière",
    camp: "village",
    rule: "Elle a deux potions pour toute la partie : une pour sauver la victime des loups, une pour tuer le joueur de son choix. Elle peut s'en servir la même nuit, ou les garder.",
  },
  {
    id: "barbier",
    name: "Barbier",
    camp: "village",
    rule: "Une fois dans la partie, de jour, il peut dévoiler sa carte et tuer un joueur sans débat. Si c'est un loup-garou, le barbier reste en jeu mais perd son pouvoir. Sinon, il meurt avec lui.",
  },
  {
    id: "infect",
    name: "Infect père des loups",
    camp: "loups",
    rule: "C'est un loup-garou. Une seule fois dans la partie, au lieu de laisser mourir la victime des loups, il peut l'infecter : elle survit, mais devient loup-garou en secret, tout en gardant son pouvoir.",
  },
  {
    id: "loupblanc",
    name: "Loup blanc",
    camp: "solo",
    rule: "Il se réveille avec les loups, mais ne joue que pour lui : une nuit sur deux, il peut dévorer un loup-garou. Il gagne s'il est le dernier en vie.",
  },
  {
    id: "idiot",
    name: "Idiot du village",
    camp: "village",
    rule: "S'il est éliminé par le vote du village, il dévoile sa carte et reste en vie : on le gracie, mais il ne vote plus. La nuit, il meurt comme tout le monde.",
  },
  {
    id: "juge",
    name: "Juge",
    camp: "village",
    rule: "Une fois dans la partie, d'un signe convenu avec le meneur, il déclenche un second vote juste après le premier, sans débat.",
  },
  {
    id: "servante",
    name: "Servante dévouée",
    camp: "village",
    rule: "Quand un joueur est éliminé par le vote, avant qu'on montre sa carte, elle peut se dévoiler et prendre son rôle. Elle abandonne le sien et joue désormais celui de l'éliminé.",
  },
  {
    id: "chasseur",
    name: "Chasseur",
    camp: "village",
    rule: "Quand il meurt, quelle qu'en soit la cause, il tire une dernière balle et élimine le joueur de son choix.",
  },
  {
    id: "chevalier",
    name: "Chevalier à l'épée rouillée",
    camp: "village",
    rule: "S'il est dévoré par les loups, le premier loup-garou à sa gauche attrape le tétanos et meurt la nuit suivante.",
  },
  {
    id: "montreur",
    name: "Montreur d'ours",
    camp: "village",
    rule: "Chaque matin, si l'un de ses deux voisins directs encore en vie est un loup-garou, l'ours grogne : le meneur le fait savoir à tout le village.",
  },
  {
    id: "renard",
    name: "Renard",
    camp: "village",
    rule: "La nuit, il désigne trois voisins. S'il y a au moins un loup-garou parmi eux, il garde son flair ; sinon, il le perd pour le reste de la partie.",
  },
  {
    id: "corbeau",
    name: "Corbeau",
    camp: "village",
    rule: "Chaque nuit, il peut désigner un joueur, qui aura deux voix contre lui au vote du lendemain.",
  },
  {
    id: "soeur",
    name: "Sœur",
    camp: "village",
    rule: "Les deux sœurs se réveillent ensemble la première nuit pour se reconnaître, et peuvent se concerter certaines nuits. Elles sont du côté du village.",
  },
  {
    id: "bouc",
    name: "Bouc émissaire",
    camp: "village",
    rule: "En cas d'égalité au vote, c'est lui qui est éliminé. Avant de partir, il désigne qui aura le droit de voter le lendemain.",
  },
  {
    id: "voyante",
    name: "Voyante",
    camp: "village",
    rule: "Chaque nuit, elle découvre en secret le rôle d'un joueur de son choix.",
  },
  {
    id: "petitefille",
    name: "Petite fille",
    camp: "village",
    rule: "La nuit, elle peut entrouvrir les yeux pour espionner les loups-garous. Si les loups la surprennent, elle risque de devenir leur victime.",
  },
] as const satisfies readonly RoleCard[];

export type RoleId = (typeof ROLES)[number]["id"];

const BY_ID = new Map<string, RoleCard>(ROLES.map((r) => [r.id, r]));

export const isRoleId = (id: string): id is RoleId => BY_ID.has(id);
export const roleOf = (id: string): RoleCard | undefined => BY_ID.get(id);
export const roleName = (id: string | null | undefined) => (id ? (BY_ID.get(id)?.name ?? id) : "?");

/** The wolf cards: what « peste noire » counts to add spare cards, and what can leave the village without wolves. */
export const WOLF_CARDS: readonly RoleId[] = ["loup", "infect", "loupblanc"];
