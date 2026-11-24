import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { searchClub } from "@/modules/search/search";

export const metadata: Metadata = { title: "Rechercher" };

/** One box for the whole club: objects, dons, recipes, potlucks, agenda, members. A plain GET form, so it works before any script loads. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = (await getSession())!;
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const groups = await searchClub(q, session.member.id, await isAdminModeActive());
  const total = groups.reduce((n, g) => n + g.hits.length, 0);

  return (
    <Container>
      <PageTitle>Rechercher</PageTitle>
      <form action="/recherche" role="search" className="mt-5 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus={!q}
          placeholder="Une perceuse, une recette, un prénom…"
          aria-label="Rechercher dans le club"
          className="min-h-12 w-full rounded-full border border-line bg-surface px-5 text-base text-ink placeholder:text-muted focus:border-primary focus:outline-none"
        />
        <button type="submit" className="min-h-12 shrink-0 rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink hover:opacity-90">
          Chercher
        </button>
      </form>

      {q.trim().length >= 2 && (
        <p className="mt-4 text-sm text-muted" aria-live="polite">
          {total === 0 ? `Rien ne correspond à « ${q.trim()} » dans le club.` : `${total} résultat${total > 1 ? "s" : ""} pour « ${q.trim()} ».`}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{g.label}</h2>
            <Card className="mt-2 divide-y divide-line-soft">
              {g.hits.map((h) => (
                <Link key={h.href + h.title} href={h.href} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 hover:bg-surface-raised">
                  <span className="font-medium text-ink">{h.title}</span>
                  {h.detail && <span className="shrink-0 text-sm text-muted">{h.detail}</span>}
                </Link>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </Container>
  );
}
