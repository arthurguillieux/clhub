"use client";

import { usePathname } from "next/navigation";
import { SectionSubNav } from "@/core/ui/components/SectionSubNav";

const ITEMS = [
  { href: "/pretotheque", label: "Catalogue" },
  { href: "/pretotheque/planning", label: "Planning" },
  { href: "/pretotheque/recherches", label: "Recherches" },
  { href: "/pretotheque/etiquettes", label: "Étiquettes" },
];

// Reached from the profile menu ("Mon activité"), not from browsing the
// catalogue — showing the catalogue's own tab bar there (with none of its
// tabs actually active) read as a stray, unrelated sub-header rather than
// where the member actually is.
const HIDE_SUBNAV_ON = ["/pretotheque/mine"];

export default function PretothequeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {!HIDE_SUBNAV_ON.includes(pathname) && <SectionSubNav items={ITEMS} />}
      {children}
    </>
  );
}
