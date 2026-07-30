/**
 * Reuses the existing brand + item-category hues rather than inventing a
 * parallel palette — same reasoning as CATEGORY_BG in categories.ts:
 * Tailwind only picks up classes it can see literally in source.
 */
export interface PlayerColor {
  key: string;
  label: string;
  /** Solid fill — swatch buttons and the color-picker trigger dot. */
  bg: string;
  /** Low-opacity fill — the player tag's own background. */
  soft: string;
  /** The player tag's border. */
  border: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  { key: "primary", label: "Vert", bg: "bg-primary", soft: "bg-primary/15", border: "border-primary/50" },
  { key: "accent", label: "Rose", bg: "bg-accent", soft: "bg-accent/15", border: "border-accent/50" },
  {
    key: "bricolage",
    label: "Orange",
    bg: "bg-cat-bricolage",
    soft: "bg-cat-bricolage/15",
    border: "border-cat-bricolage/50",
  },
  {
    key: "jardinage",
    label: "Citron",
    bg: "bg-cat-jardinage",
    soft: "bg-cat-jardinage/15",
    border: "border-cat-jardinage/50",
  },
  { key: "menage", label: "Cyan", bg: "bg-cat-menage", soft: "bg-cat-menage/15", border: "border-cat-menage/50" },
  { key: "festif", label: "Violet", bg: "bg-cat-festif", soft: "bg-cat-festif/15", border: "border-cat-festif/50" },
  { key: "autre", label: "Gris", bg: "bg-cat-autre", soft: "bg-cat-autre/15", border: "border-cat-autre/50" },
];

export function playerColorByKey(key: string): PlayerColor {
  return PLAYER_COLORS.find((c) => c.key === key) ?? PLAYER_COLORS[0]!;
}
