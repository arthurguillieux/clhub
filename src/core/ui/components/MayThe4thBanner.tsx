import { today } from "@/core/date";

/** Server-computed (Europe/Paris) so it can't fire off-by-one-day on a visitor's own clock. */
export function MayThe4thBanner() {
  if (today().slice(5) !== "05-04") return null;

  return (
    <div className="border-b border-primary/30 bg-surface-raised px-4 py-2 text-center print:hidden sm:px-6">
      <p className="glow-text-primary text-sm font-medium text-primary">Que la HUB soit avec toi.</p>
    </div>
  );
}
