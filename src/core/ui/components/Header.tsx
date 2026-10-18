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
    <header className="border-b border-line-soft bg-surface print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <AdminGateLogo />

        <nav className="flex items-center gap-5">
          <Link href="/membres" className="-mx-1 -my-2.5 px-1 py-2.5 text-sm font-medium text-muted hover:text-ink">
            Membres
          </Link>
          <SectionsMenu />
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
