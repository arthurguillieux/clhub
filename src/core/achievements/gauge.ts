/**
 * The lender/borrower gauge (docs/01-produit.md §6) — measured in
 * jours-objets (item-days), never in loan count, so lending a drill for an
 * afternoon doesn't weigh the same as lending a rototiller for two weeks.
 * Deliberately a spectrum, not a score: nothing here is a ranking between
 * members, just a private, playful read of one's own balance.
 */
export interface GaugePosition {
  /** -1 (pure borrower) to +1 (pure lender), 0 = balanced or no activity yet. */
  ratio: number;
  label: string;
  emoji: string;
}

const BALANCED_BAND = 0.15;
const STRONG_LEAN = 0.6;

export function gaugePosition(lentDays: number, borrowedDays: number): GaugePosition {
  const total = lentDays + borrowedDays;
  const ratio = total === 0 ? 0 : (lentDays - borrowedDays) / total;

  if (Math.abs(ratio) <= BALANCED_BAND) return { ratio, label: "Équilibré", emoji: "⚖️" };
  if (ratio > STRONG_LEAN) return { ratio, label: "Mécène du club", emoji: "🛠️" };
  if (ratio > 0) return { ratio, label: "Plutôt prêteur", emoji: "🤝" };
  if (ratio < -STRONG_LEAN) return { ratio, label: "Emprunteur en série", emoji: "🫴" };
  return { ratio, label: "Plutôt emprunteur", emoji: "🙋" };
}
