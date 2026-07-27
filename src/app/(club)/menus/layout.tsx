import { SectionSubNav } from "@/core/ui/components/SectionSubNav";

const ITEMS = [
  { href: "/menus", label: "Tous les repas" },
  { href: "/menus/new", label: "Proposer un repas" },
];

export default function MenusLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionSubNav items={ITEMS} />
      {children}
    </>
  );
}
