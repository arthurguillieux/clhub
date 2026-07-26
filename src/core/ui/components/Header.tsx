import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/pretotheque", label: "Prêtothèque" },
  { href: "/pretotheque/planning", label: "Planning" },
  { href: "/pretotheque/recherches", label: "Recherches" },
  { href: "/pretotheque/mine", label: "Mon activité" },
  { href: "/menus", label: "Menus" },
  { href: "/wrapped", label: "Wrapped" },
  { href: "/invite", label: "Inviter" },
];

// Deliberately minimal — just what the header renders, so it doesn't care
// whether the caller's session shape comes from Better Auth or our own
// Drizzle types (which differ slightly on optional-vs-nullable fields).
interface HeaderUser {
  name: string;
  image?: string | null;
}
interface HeaderMember {
  memberNumber: number | null;
}

export function Header({ user, member }: { user: HeaderUser; member: HeaderMember }) {
  return (
    <header className="border-b border-line-soft bg-surface print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-lg font-extrabold tracking-tight text-ink">
          LE CL<span className="text-primary">HUB</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-muted sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-full border border-line-soft py-1 pr-3 pl-1 text-sm text-ink hover:bg-surface-raised"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- small avatar thumbnail, no need for next/image here
            <img src={user.image} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="hidden sm:inline">#{member.memberNumber}</span>
        </Link>
      </div>

      <nav className="flex items-center gap-4 overflow-x-auto border-t border-line-soft px-4 py-2 text-sm font-medium text-muted sm:hidden">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="whitespace-nowrap hover:text-ink">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
