import Link from "next/link";
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
export function Header({ user }: { user: HeaderUser }) {
  return (
    <header className="border-b border-line-soft bg-surface print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <AdminGateLogo />

        <nav className="flex items-center gap-5">
          <Link href="/membres" className="text-sm font-medium text-muted hover:text-ink">
            Membres
          </Link>
          <SectionsMenu />
        </nav>

        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
