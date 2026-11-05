/**
 * The looks an organizer can give their Secret Santa: its pages and its mails. A theme only changes
 * the clothes, never what anyone can do or see. A new one needs an entry here, a `.santa-<id>` block
 * in globals.css, a scene in Scene.tsx and a palette in SantaEmail.tsx.
 */
export const SANTA_THEMES = [
  { id: "neon", name: "Néon", hint: "La nuit du CLHUB, vert et rouge, une lueur de feu" },
  { id: "blanc", name: "Noël blanc", hint: "Un matin dans les sapins, la neige s'accumule" },
] as const;

export type SantaTheme = (typeof SANTA_THEMES)[number]["id"];

export const SANTA_THEME_IDS = ["neon", "blanc"] as const satisfies readonly SantaTheme[];

export const asTheme = (value: string): SantaTheme => SANTA_THEME_IDS.find((id) => id === value) ?? "neon";
