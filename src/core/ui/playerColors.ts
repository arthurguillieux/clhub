/**
 * Reuses the existing brand + item-category hues rather than inventing a
 * parallel palette — same reasoning as CATEGORY_BG in categories.ts:
 * Tailwind only picks up classes it can see literally in source.
 */
export interface PlayerColor {
  key: string;
  label: string;
  bg: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  { key: "primary", label: "Vert", bg: "bg-primary" },
  { key: "accent", label: "Rose", bg: "bg-accent" },
  { key: "bricolage", label: "Orange", bg: "bg-cat-bricolage" },
  { key: "jardinage", label: "Citron", bg: "bg-cat-jardinage" },
  { key: "menage", label: "Cyan", bg: "bg-cat-menage" },
  { key: "festif", label: "Violet", bg: "bg-cat-festif" },
  { key: "autre", label: "Gris", bg: "bg-cat-autre" },
];

export function playerColorByKey(key: string): PlayerColor {
  return PLAYER_COLORS.find((c) => c.key === key) ?? PLAYER_COLORS[0]!;
}
