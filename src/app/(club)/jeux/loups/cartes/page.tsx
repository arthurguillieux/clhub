import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { cardArt } from "@/modules/loups/data/games";
import { ROLES } from "@/modules/loups/domain/roles";
import { CardUploads } from "./CardUploads";

export const metadata: Metadata = { title: "Les cartes · Loups-garous" };

/** The meneur's own pictures of their cards, uploaded once and kept on the NAS. */
export default async function CardsPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx
  const art = await cardArt(session.member.id);
  return (
    <div className="loups-poster mx-auto my-4 max-w-3xl px-5 py-7 sm:px-8">
      <Link href="/jeux/loups" className="loups-muted text-sm">
        ← Loups-garous
      </Link>
      <h1 className="loups-title mt-3 text-4xl">Tes cartes</h1>
      <p className="loups-muted mt-2 max-w-prose text-sm">
        Photographie ou scanne tes propres cartes : le dos une fois, puis la face de chaque carte que tu joues. Elles apparaissent quand une carte se retourne (sur ton téléphone, ceux des joueurs et
        l&apos;écran de la salle). Elles restent sur le NAS du CLHUB, visibles seulement par tes parties. Une carte sans image garde le dessin du CLHUB.
      </p>
      <CardUploads art={art} faces={[{ id: "verso", name: "Le dos des cartes" }, ...ROLES.map((r) => ({ id: r.id, name: r.name }))]} />
    </div>
  );
}
