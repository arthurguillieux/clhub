import { adminBannerState } from "@/core/auth/admin";
import { lockAdminAction, viewAsMemberAction } from "@/app/(club)/admin/actions";

/**
 * Sticky, on every (club) page, deliberately off-palette (amber, not the
 * brand green/pink) — the whole point is that it reads as "you currently
 * have destructive power", not as another themed section of the site.
 * « Voir comme un membre » turns the powers off to see the CLHUB as an
 * ordinary member does; the banner then turns blue-grey and offers the way back.
 */
export async function AdminModeBanner() {
  const state = await adminBannerState();
  if (!state) return null;

  if (state === "member-view")
    return (
      <div className="sticky top-0 z-40 border-b border-sky-400/40 bg-sky-500/15 px-4 py-2 backdrop-blur sm:px-6 dark:bg-sky-500/10">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="text-sm font-semibold text-sky-800 dark:text-sky-300">
            👁 Vue membre
            <span className="hidden sm:inline"> — tu vois le CLHUB comme un membre simple, sans tes pouvoirs d&apos;admin.</span>
          </p>
          <form action={viewAsMemberAction.bind(null, false)}>
            <button
              type="submit"
              className="min-h-9 shrink-0 rounded-md border border-sky-600/40 px-3 text-xs font-semibold whitespace-nowrap text-sky-800 hover:bg-sky-500/20 dark:text-sky-300"
            >
              Revenir en mode admin
            </button>
          </form>
        </div>
      </div>
    );

  return (
    <div className="sticky top-0 z-40 border-b border-amber-400/40 bg-amber-500/15 px-4 py-2 backdrop-blur sm:px-6 dark:bg-amber-500/10">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          🛡️ Mode admin actif
          {/* The explanation is for the first time you see it — on a phone it only costs two lines. */}
          <span className="hidden sm:inline"> — modifications et suppressions possibles partout sur le site.</span>
        </p>
        <div className="flex shrink-0 gap-2">
          <form action={viewAsMemberAction.bind(null, true)}>
            <button
              type="submit"
              className="min-h-9 rounded-md border border-amber-600/40 px-3 text-xs font-semibold whitespace-nowrap text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
            >
              Voir comme un membre
            </button>
          </form>
          <form action={lockAdminAction}>
            <button
              type="submit"
              className="min-h-9 rounded-md border border-amber-600/40 px-3 text-xs font-semibold whitespace-nowrap text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
            >
              Quitter le mode admin
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
