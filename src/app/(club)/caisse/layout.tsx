import { SectionSubNav } from "@/core/ui/components/SectionSubNav";

const ITEMS = [
  { href: "/caisse", label: "Journal" },
  { href: "/caisse/new", label: "Ajouter un mouvement" },
];

export default function CaisseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionSubNav items={ITEMS} />
      {children}
    </>
  );
}
