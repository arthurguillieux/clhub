import Link from "next/link";

/**
 * « Modifier »-style link next to a title or a list row. Small on screen, but
 * the padding / negative-margin pair widens the tappable area to a thumb
 * without moving anything (the two cancel out in a flex row).
 */
export function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="-mx-1.5 -my-2.5 px-1.5 py-2.5 text-xs font-semibold text-primary hover:underline">
      {children}
    </Link>
  );
}
