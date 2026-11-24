/**
 * This screen has its own art direction: it keeps its colours whatever the display setting
 * (Réglages › Apparence) — see `[data-own-theme]` in globals.css.
 */
export default function OwnThemeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-own-theme="" className="contents">
      {children}
    </div>
  );
}
