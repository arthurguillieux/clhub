/**
 * The buzzer's animals — each one doubles as the team's colour, so picking an
 * animal replaces picking a colour. Colours are the site's neon palette
 * (see globals.css), all bright enough to read on the dark theme.
 */
export interface Avatar {
  id: string;
  name: string;
  color: string;
}

export const AVATARS: readonly Avatar[] = [
  { id: "renard", name: "Renard", color: "#ff7a29" },
  { id: "grenouille", name: "Grenouille", color: "#39ffb0" },
  { id: "poussin", name: "Poussin", color: "#ffcc29" },
  { id: "cochon", name: "Cochon", color: "#ff3ec9" },
  { id: "pieuvre", name: "Pieuvre", color: "#c04dff" },
  { id: "baleine", name: "Baleine", color: "#29e0ff" },
  { id: "crabe", name: "Crabe", color: "#ff4d5e" },
  { id: "dino", name: "Dino", color: "#baff29" },
];

export function avatarById(id: string): Avatar | null {
  return AVATARS.find((a) => a.id === id) ?? null;
}
