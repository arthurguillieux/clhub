import { SectionSubNav } from "@/core/ui/components/SectionSubNav";

const ITEMS = [
  { href: "/jeux", label: "Compteur de points" },
  { href: "/jeux/des", label: "Lancer de dés" },
];

export default function JeuxLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionSubNav items={ITEMS} />
      {children}
    </>
  );
}
