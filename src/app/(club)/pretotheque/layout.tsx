import { SectionSubNav } from "@/core/ui/components/SectionSubNav";

const ITEMS = [
  { href: "/pretotheque", label: "Catalogue" },
  { href: "/pretotheque/planning", label: "Planning" },
  { href: "/pretotheque/recherches", label: "Recherches" },
  { href: "/pretotheque/etiquettes", label: "Étiquettes" },
  { href: "/pretotheque/new", label: "Ajouter un objet" },
];

export default function PretothequeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionSubNav items={ITEMS} />
      {children}
    </>
  );
}
