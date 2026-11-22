import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { customRules, rulesFor } from "@/modules/loups/data/games";
import { ROLES } from "@/modules/loups/domain/roles";
import { RuleEditor } from "./RuleEditor";

export const metadata: Metadata = { title: "Loups-garous — les règles" };

/** The rule of each card, as the meneur's players will read it on the game's link. */
export default async function LoupsRulesPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx
  const [rules, custom] = await Promise.all([rulesFor(session.member.id), customRules(session.member.id)]);
  return (
    <div className="loups-poster mx-auto my-4 max-w-3xl px-5 py-7 sm:px-8">
      <Link href="/jeux/loups" className="loups-muted relative text-sm">
        ← Loups-garous
      </Link>
      <h1 className="loups-title mt-3 text-4xl">Les règles des cartes</h1>
      <p className="loups-muted mt-2 text-sm">Tes joueurs lisent ces textes sur le lien de la partie. Change ce que tu joues autrement : c&apos;est ta version qui s&apos;affiche.</p>
      <div className="mt-6 flex flex-col gap-3">
        {ROLES.map((r) => (
          <RuleEditor key={r.id} role={r.id} name={r.name} text={rules[r.id] ?? r.rule} original={r.rule} custom={custom.includes(r.id)} />
        ))}
      </div>
    </div>
  );
}
