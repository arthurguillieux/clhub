"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SectionSubNavItem {
  href: string;
  label: string;
}

/** The contextual bar under the header, one per section — so leaving the Prêtothèque for Menus (or vice versa) actually changes what's on screen, not just the page content. */
export function SectionSubNav({ items }: { items: SectionSubNavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-line-soft bg-surface-raised px-4 print:hidden sm:px-6">
      <nav className="mx-auto flex max-w-4xl gap-5 overflow-x-auto py-2.5 text-sm font-medium">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap ${active ? "text-primary" : "text-muted hover:text-ink"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
