import type { LetterStage } from "./domain/letter";

/** What each side gets to see of a letter. The family never sees another person's amount in a cagnotte. */

export interface OfferView {
  id: string;
  name: string;
  /** A part of a cagnotte. For the family, only their own: others' amounts stay with the organizers. */
  amountCents: number | null;
  received: boolean;
  /** Made from this browser: its author can take it back. */
  mine: boolean;
}

export interface GiftView {
  id: string;
  title: string;
  url: string | null;
  priceCents: number | null;
  note: string;
  secondHand: boolean;
  favorite: boolean;
  copies: number | null;
  pot: boolean;
  photo: string | null;
  offers: OfferView[];
  /** A cagnotte's promises added up: what the gauge shows. */
  totalCents: number;
  full: boolean;
}

export interface FamilyView {
  letterId: string;
  title: string;
  childName: string;
  words: string;
  advice: string;
  payNote: string;
  photo: string | null;
  thanks: { text: string; photo: string | null } | null;
  stage: LetterStage;
  /** An organizer looking before the letter is sent: nothing can be reserved yet. */
  preview: boolean;
  gifts: GiftView[];
  /** The first name this browser gave last time, to fill it in again. */
  myName: string | null;
}

export interface OrgView {
  code: string;
  link: string;
  title: string;
  childName: string;
  year: number;
  words: string;
  advice: string;
  payNote: string;
  photo: string | null;
  thanksText: string;
  thanksPhoto: string | null;
  thanksPublished: boolean;
  stage: LetterStage;
  hasCohostPassword: boolean;
  cohosts: { memberId: string; name: string }[];
  previousTitle: string | null;
  gifts: GiftView[];
}
