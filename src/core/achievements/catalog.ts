/**
 * Pure badge rules — no DB. Each evaluator is a function of `MemberStats`,
 * a plain snapshot of numbers already computed elsewhere (see stats.ts).
 * Per docs/01-produit.md §6: no streak-chasing incentive, nothing punitive,
 * nothing comparing members against each other — every rule here is either
 * a one-off milestone or a private, positive-framed count.
 */
export interface MemberStats {
  memberNumber: number | null;
  itemsListedCount: number;
  /** Current unbroken run of on-time returns, most recent first. */
  consecutiveOnTimeReturns: number;
  /** Total late returns ever, not just recent ones. */
  cumulativeLateReturns: number;
  /** Fastest owner response time on an approved request, in minutes — null if never approved one. */
  fastestApprovalMinutes: number | null;
  /** Sum of price/replacement value (cents) across every item this member has listed. */
  materialSharedValueCents: number;
  /** Members invited by this member who actually joined. */
  referralCount: number;
  /** At least one weekend where 5+ distinct members had a booking, including this one. */
  hadCollectiveWeekend: boolean;
  /** Picked up an item between 22:00 and 06:00 at least once. */
  hadLateNightPickup: boolean;
  /** Owns an item that's been through 20+ loans without a single signalement. */
  hasUnbreakableItem: boolean;
  /** Has listed items but never once borrowed anything. */
  isPureLender: boolean;
}

export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  hint: string | null;
  icon: string;
  secret: boolean;
  sort: number;
  evaluate: (stats: MemberStats) => boolean;
}

export const FOUNDER_MAX_MEMBER_NUMBER = 5;
export const QUINCAILLIER_MIN_ITEMS = 10;
export const ON_TIME_STREAK_TARGET = 10;
export const LATE_RETURNS_TARGET = 3;
export const FAST_APPROVAL_MINUTES = 60;
export const MECENE_MIN_CENTS = 100_000; // 1000 €
export const PARRAIN_MIN_REFERRALS = 3;
export const UNBREAKABLE_ITEM_MIN_LOANS = 20;
export const PURE_LENDER_MIN_ITEMS = 3;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: "membre-fondateur",
    name: "Membre fondateur",
    description: "Fait partie des cinq premiers membres du club.",
    hint: null,
    icon: "🏛️",
    secret: false,
    sort: 10,
    evaluate: (s) => s.memberNumber !== null && s.memberNumber <= FOUNDER_MAX_MEMBER_NUMBER,
  },
  {
    key: "quincaillier",
    name: "Quincaillier",
    description: `A mis ${QUINCAILLIER_MIN_ITEMS} objets ou plus à disposition du club.`,
    hint: null,
    icon: "🧰",
    secret: false,
    sort: 20,
    evaluate: (s) => s.itemsListedCount >= QUINCAILLIER_MIN_ITEMS,
  },
  {
    key: "toujours-a-lheure",
    name: "Toujours à l'heure",
    description: `${ON_TIME_STREAK_TARGET} retours consécutifs sans retard.`,
    hint: null,
    icon: "⏰",
    secret: false,
    sort: 30,
    evaluate: (s) => s.consecutiveOnTimeReturns >= ON_TIME_STREAK_TARGET,
  },
  {
    key: "tete-en-lair",
    name: "Tête en l'air",
    description: `${LATE_RETURNS_TARGET} retards cumulés — ça arrive.`,
    hint: null,
    icon: "🌀",
    secret: false,
    sort: 40,
    evaluate: (s) => s.cumulativeLateReturns >= LATE_RETURNS_TARGET,
  },
  {
    key: "sauveur",
    name: "Sauveur",
    description: "A validé une demande de prêt en moins d'une heure.",
    hint: null,
    icon: "🦸",
    secret: false,
    sort: 50,
    evaluate: (s) => s.fastestApprovalMinutes !== null && s.fastestApprovalMinutes < FAST_APPROVAL_MINUTES,
  },
  {
    key: "le-mecene",
    name: "Le Mécène",
    description: "Plus de 1 000 € de matériel partagé avec le club.",
    hint: null,
    icon: "💎",
    secret: false,
    sort: 60,
    evaluate: (s) => s.materialSharedValueCents > MECENE_MIN_CENTS,
  },
  {
    key: "chantier-collectif",
    name: "Chantier collectif",
    description: "A emprunté un week-end où cinq membres ou plus empruntaient en même temps.",
    hint: null,
    icon: "🏗️",
    secret: false,
    sort: 70,
    evaluate: (s) => s.hadCollectiveWeekend,
  },
  {
    key: "parrain",
    name: "Parrain",
    description: `A parrainé ${PARRAIN_MIN_REFERRALS} membres ou plus.`,
    hint: null,
    icon: "🌱",
    secret: false,
    sort: 80,
    evaluate: (s) => s.referralCount >= PARRAIN_MIN_REFERRALS,
  },
  {
    key: "oiseau-de-nuit",
    name: "Oiseau de nuit",
    description: "A récupéré un emprunt en pleine nuit.",
    hint: "Certains membres ne dorment jamais...",
    icon: "🦉",
    secret: true,
    sort: 90,
    evaluate: (s) => s.hadLateNightPickup,
  },
  {
    key: "increvable",
    name: "Increvable",
    description: "Un de ses objets a survécu à vingt prêts sans le moindre signalement.",
    hint: "Un objet du club a une résistance à toute épreuve.",
    icon: "🪨",
    secret: true,
    sort: 100,
    evaluate: (s) => s.hasUnbreakableItem,
  },
  {
    key: "vide-grenier",
    name: "Vide-grenier",
    description: "A mis des objets à disposition sans jamais rien emprunter lui-même.",
    hint: "Certains donnent, et c'est très bien comme ça.",
    icon: "📦",
    secret: true,
    sort: 110,
    evaluate: (s) => s.isPureLender && s.itemsListedCount >= PURE_LENDER_MIN_ITEMS,
  },
];
