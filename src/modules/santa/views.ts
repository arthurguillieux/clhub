import type { MealKind, Presence } from "./domain/meals";
import type { SantaTheme } from "./themes";

/** What each kind of person gets to see of a Secret Santa. Organizers never get who drew whom here. */

export type SantaStatus = "preparation" | "launched";

export interface OrgParticipant {
  id: string;
  name: string;
  isMember: boolean;
  /** Guests only: a member's address stays in their account. */
  email: string | null;
  mailSent: boolean;
  mailError: string | null;
  /** Has opened their gift. */
  revealed: boolean;
}

export interface OrgView {
  code: string;
  title: string;
  status: SantaStatus;
  archived: boolean;
  budget: string;
  exchangeDate: string | null;
  message: string;
  theme: SantaTheme;
  participants: OrgParticipant[];
  exclusions: { id: string; fromId: string; toId: string; fromName: string; toName: string; mutual: boolean }[];
  cohosts: { memberId: string; name: string }[];
  hasCohostPassword: boolean;
  /** Every look at the draw, for all organizers to see. */
  unmasks: { who: string; whom: string; at: string }[];
  /** Null when the draw can run; otherwise what stands in the way, in plain words. */
  blocker: string | null;
  /** Last year's event, whose draw this one avoids. */
  previousTitle: string | null;
  meals: MealsSettingsView;
}

/** The organizers' side of « 🍽️ Les repas »: on or off, the days, and each meal of the range. */
export interface MealsSettingsView {
  enabled: boolean;
  from: string | null;
  to: string | null;
  note: string;
  /** Each meal of the range, with what's already written on it (dishes, answers). */
  slots: { id: string; day: string; meal: MealKind; off: boolean; dishes: number; answers: number }[];
  /** Meals taken off or left out of the range that still hold something: hidden from everyone, not erased. */
  hidden: { id: string; day: string; meal: MealKind; off: boolean; outOfRange: boolean; answers: number; dishes: { who: string; what: string }[] }[];
}

/** The meals page, the same for everyone; `me` is who the viewer is among the participants, if anyone. */
export interface MealsView {
  title: string;
  theme: SantaTheme;
  archived: boolean;
  note: string;
  days: { day: string; meals: { id: string; meal: MealKind }[] }[];
  people: { id: string; name: string; diet: string; guests: number; presence: Record<string, Presence> }[];
  dishes: { id: string; mealId: string; who: string; withId: string | null; what: string; category: string; parts: number | null; veg: boolean; note: string; idea: boolean }[];
  drinks: { id: string; who: string; type: string; quantity: number; unit: string; what: string }[];
  /** The viewer's own dishes, on every meal, including one hidden for now (so nothing seems lost). */
  mine: { id: string; day: string; meal: MealKind; what: string; idea: boolean; hidden: boolean }[];
  me: string | null;
  organizer: boolean;
}

export interface QuestionView {
  id: string;
  question: string;
  answer: string | null;
}

export interface MeView {
  title: string;
  organizer: string;
  budget: string;
  exchangeDate: string | null;
  message: string;
  theme: SantaTheme;
  status: SantaStatus;
  archived: boolean;
  name: string;
  letter: string;
  revealed: boolean;
  /** Who they give to — only once they've opened their gift. */
  recipient: { name: string; letter: string } | null;
  /** Their questions to the person they drew. */
  asked: QuestionView[];
  /** What their own Santa asks them. */
  toAnswer: QuestionView[];
  /** The organizers turned on « 🍽️ Les repas ». */
  meals: boolean;
}
