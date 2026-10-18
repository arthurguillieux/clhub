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
          🛡️ Mode admin actif
          {/* The explanation is for the first time you see it — on a phone it only costs two lines. */}
          <span className="hidden sm:inline"> — modifications et suppressions possibles partout sur le site.</span>
        </p>
        <form action={lockAdminAction}>
          <button
            type="submit"
            className="min-h-9 shrink-0 rounded-md border border-amber-600/40 px-3 text-xs font-semibold whitespace-nowrap text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
          >
            Quitter le mode admin
          </button>
        </form>
      </div>
    </div>
  );
}
