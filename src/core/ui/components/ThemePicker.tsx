"use client";

import { useState } from "react";
import { THEME_COOKIE, themeClass, type Theme } from "@/core/ui/theme";
import { toast } from "./Toaster";

const CHOICES: { value: Theme; label: string; hint: string }[] = [
  { value: "dark", label: "Sombre", hint: "Le CLHUB de toujours : noir et néons." },
  { value: "light", label: "Clair", hint: "Le même club, au grand jour." },
  { value: "auto", label: "Automatique", hint: "Suit le réglage de ton téléphone ou de ton ordinateur." },
];

/** Applies a display setting at once, and remembers it on this device for a year. */
export function applyTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  const html = document.documentElement;
  html.classList.remove("dark", "light", "theme-auto");
  html.classList.add(themeClass(theme));
}

/** Réglages › Apparence: three pills, saved as soon as one is chosen. */
export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  return (
    <div>
      <div role="radiogroup" aria-label="Apparence" className="flex flex-wrap gap-2">
        {CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={theme === c.value}
            onClick={() => {
              setTheme(c.value);
              applyTheme(c.value);
              toast(`Affichage : ${c.label.toLowerCase()}`);
            }}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${theme === c.value ? "border-primary bg-primary text-primary-ink" : "border-line text-ink hover:bg-surface-raised"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{CHOICES.find((c) => c.value === theme)?.hint} Les jeux et les sections qui ont leur propre décor le gardent.</p>
    </div>
  );
}
