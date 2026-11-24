"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/core/ui/components/Card";

interface Member {
  id: string;
  name: string | null;
  image: string | null;
  memberNumber: number | null;
}

/** Fold accents and case, so « elo » finds « Éloïse ». */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** The club's members, with a quick search once there are enough of them to need one. */
export function MemberList({ members }: { members: Member[] }) {
  const [q, setQ] = useState("");
  const shown = q.trim() ? members.filter((m) => fold(m.name ?? "").includes(fold(q.trim()))) : members;

  return (
    <div className="mt-6">
      {members.length > 8 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un membre…"
          aria-label="Chercher un membre par son nom"
          className="mb-4 min-h-11 w-full rounded-full border border-line bg-surface px-4 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none sm:max-w-xs"
        />
      )}
      {shown.length === 0 ? (
        <p className="text-sm text-muted">Personne ne s&apos;appelle comme ça au club.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map((m) => {
            const name = m.name || "Membre";
            return (
              <li key={m.id}>
                <Link href={`/membres/${m.id}`} className="block h-full">
                  <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:border-primary">
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small avatar thumbnail
                      <img src={m.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-sm font-extrabold text-accent-ink">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="font-display text-base font-extrabold text-ink">{name}</p>
                      <p className="text-xs text-muted">Membre {m.memberNumber !== null ? `n°${m.memberNumber}` : ""}</p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
