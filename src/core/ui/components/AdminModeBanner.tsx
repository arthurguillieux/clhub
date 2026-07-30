import { isAdminModeActive } from "@/core/auth/admin";
import { lockAdminAction } from "@/app/(club)/admin/actions";

/**
 * Sticky, on every (club) page, deliberately off-palette (amber, not the
 * brand green/pink) — the whole point is that it reads as "you currently
 * have destructive power", not as another themed section of the site.
 */
export async function AdminModeBanner() {
  const active = await isAdminModeActive();
  if (!active) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-amber-400/40 bg-amber-500/15 px-4 py-2 backdrop-blur sm:px-6 dark:bg-amber-500/10">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          🛡️ Mode admin actif — modifications et suppressions possibles partout sur le site.
        </p>
        <form action={lockAdminAction}>
          <button
            type="submit"
            className="shrink-0 rounded-md border border-amber-600/40 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
          >
            Quitter
          </button>
        </form>
      </div>
    </div>
  );
}
