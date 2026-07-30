export const CATEGORY_LABELS: Record<string, string> = {
  bricolage: "Bricolage",
  jardinage: "Jardinage",
  menage: "Ménage",
  festif: "Festif",
  jeux: "Jeux de société",
  autre: "Autre",
};

/**
 * Full class strings, written out — Tailwind's compiler only picks up
 * classes it can see literally in source, not ones assembled by
 * interpolating a category name into a template string at runtime.
 */
export const CATEGORY_BG: Record<string, string> = {
  bricolage: "bg-cat-bricolage",
  jardinage: "bg-cat-jardinage",
  menage: "bg-cat-menage",
  festif: "bg-cat-festif",
  jeux: "bg-cat-jeux",
  autre: "bg-cat-autre",
};

export const CATEGORY_TEXT: Record<string, string> = {
  bricolage: "text-cat-bricolage",
  jardinage: "text-cat-jardinage",
  menage: "text-cat-menage",
  festif: "text-cat-festif",
  jeux: "text-cat-jeux",
  autre: "text-cat-autre",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export const ITEM_STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  unavailable: "Indisponible",
  broken: "En panne",
  retired: "Retiré",
};

export function itemStatusLabel(status: string): string {
  return ITEM_STATUS_LABELS[status] ?? status;
}
