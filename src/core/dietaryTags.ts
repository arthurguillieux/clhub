/**
 * A fixed, exact-match taxonomy rather than free text — the whole point is
 * to be filterable ("recettes sans gluten") and aggregatable (menu
 * attendee summary), which free text can't reliably do. `dietaryNotes` on
 * the member profile is the escape hatch for anything this list doesn't
 * cover ("je n'aime pas les champignons").
 */
export const DIETARY_TAGS = [
  "sans-gluten",
  "vegetarien",
  "vegan",
  "sans-lactose",
  "sans-arachides",
  "sans-fruits-a-coque",
  "halal",
  "casher",
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number];

export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
  "sans-gluten": "Sans gluten",
  vegetarien: "Végétarien",
  vegan: "Vegan",
  "sans-lactose": "Sans lactose",
  "sans-arachides": "Sans arachides",
  "sans-fruits-a-coque": "Sans fruits à coque",
  halal: "Halal",
  casher: "Casher",
};

export function dietaryTagLabel(tag: string): string {
  return DIETARY_TAG_LABELS[tag as DietaryTag] ?? tag;
}

/** jsonb columns come back as `unknown` — validate/narrow defensively, same pattern as wantsEmail() in core/notifications/preferences.ts. */
export function parseDietaryTags(value: unknown): DietaryTag[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(DIETARY_TAGS);
  return value.filter((v): v is DietaryTag => typeof v === "string" && known.has(v));
}
