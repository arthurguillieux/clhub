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
}
