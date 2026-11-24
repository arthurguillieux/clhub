import Link from "next/link";
import { isAdminModeActive } from "@/core/auth/admin";
import { ProfileMenu } from "./ProfileMenu";
import { SectionsMenu } from "./SectionsMenu";
import { AdminGateLogo } from "./AdminGateLogo";

// Deliberately minimal — just what the header renders, so it doesn't care
// whether the caller's session shape comes from Better Auth or our own
// Drizzle types (which differ slightly on optional-vs-nullable fields).
interface HeaderUser {
  name: string;
  image?: string | null;
}

/**
 * Deliberately light: Accueil is one click away via the logo, and Mon
 * activité / Inviter live in the profile menu instead of competing for
 * space here. Each section adds its own contextual bar via
 * `SectionSubNav` (see e.g. pretotheque/layout.tsx) rather than cramming
 * every section's sub-pages into this one bar.
 */
export async function Header({ user }: { user: HeaderUser }) {
  const isAdmin = await isAdminModeActive();

  return (
    <header className="relative z-50 border-b border-line-soft bg-surface print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <AdminGateLogo />

        <nav className="flex items-center gap-5">
          <Link href="/recherche" aria-label="Rechercher dans le club" title="Rechercher" className="-m-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          {/* On a phone, the sections and the members are in the shortcut bar at the bottom. */}
          <span className="hidden items-center gap-5 md:flex">
            <Link href="/membres" className="-mx-1 -my-2.5 px-1 py-2.5 text-sm font-medium text-muted hover:text-ink">
              Membres
            </Link>
            <SectionsMenu />
          </span>
          {isAdmin && (
            // The after: layer is an invisible, larger tap area — the pill itself keeps its look.
            <Link
              href="/admin"
              className="glow-box-admin relative rounded-full border border-admin/60 bg-admin/15 px-3 py-1 text-xs font-bold tracking-wide text-admin uppercase after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:bg-admin/25"
            >
              Admin
            </Link>
          )}
        </nav>

        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
