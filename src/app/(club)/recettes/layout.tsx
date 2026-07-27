import { SectionSubNav } from "@/core/ui/components/SectionSubNav";

const ITEMS = [
  { href: "/recettes", label: "Toutes les recettes" },
  { href: "/recettes/new", label: "Proposer une recette" },
];

export default function RecettesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionSubNav items={ITEMS} />
      {children}
    </>
  );
}
