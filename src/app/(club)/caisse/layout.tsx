import { SectionSubNav } from "@/core/ui/components/SectionSubNav";

// Same words as the page itself: it lists « évènements », and its button says « Nouvel évènement ».
const ITEMS = [
  { href: "/caisse", label: "Évènements" },
  { href: "/caisse/new", label: "Nouvel évènement" },
];

export default function CaisseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionSubNav items={ITEMS} />
      {children}
    </>
  );
}
