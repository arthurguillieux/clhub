import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { clubEvent, donListing, item, member, recipe, user } from "@/core/db/schema";
import { listMealsFor } from "@/modules/repas/data/meals";
import { formatFrench, type CalendarDate } from "@/core/date";

export interface SearchHit {
  href: string;
  title: string;
  /** A few words of context: owner, date, where the words were found. */
  detail?: string;
}
export interface SearchGroup {
  label: string;
  hits: SearchHit[];
}

/** Fold accents and case: « eclair » finds « Éclair ». */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Every word of the query must appear somewhere in the fields (in any order). */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const hay = fold(fields.filter(Boolean).join(" "));
  return words.length > 0 && words.every((w) => hay.includes(w));
}

const LIMIT = 8;

/**
 * One search across the club. The club is small (a few hundred rows at most), so each table is read
 * whole and filtered here: accent-insensitive without any database extension, and the potlucks go
 * through the same visibility rule as their own page (open, invited, organiser, or admin).
 */
export async function searchClub(query: string, memberId: string, admin: boolean): Promise<SearchGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [items, dons, recipes, events, members, meals] = await Promise.all([
    db
      .select({ slug: item.slug, name: item.name, description: item.description, brand: item.brand, model: item.model, owner: user.name })
      .from(item)
      .innerJoin(member, eq(member.id, item.ownerId))
      .innerJoin(user, eq(user.id, member.userId))
      .orderBy(asc(item.name)),
    db.select({ id: donListing.id, title: donListing.title, description: donListing.description, status: donListing.status }).from(donListing).orderBy(desc(donListing.createdAt)),
    db.select({ id: recipe.id, title: recipe.title, ingredients: recipe.ingredients }).from(recipe).orderBy(asc(recipe.title)),
    db.select({ id: clubEvent.id, title: clubEvent.title, description: clubEvent.description, date: clubEvent.eventDate }).from(clubEvent).orderBy(desc(clubEvent.eventDate)),
    db.select({ id: member.id, name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).orderBy(asc(user.name)),
    listMealsFor(memberId, admin),
  ]);

  const groups: SearchGroup[] = [
    {
      label: "Prêtothèque",
      hits: items
        .filter((i) => matches(q, i.name, i.description, i.brand, i.model))
        .map((i) => ({ href: `/pretotheque/${i.slug}`, title: i.name, detail: `chez ${i.owner}` })),
    },
    {
      label: "Cabanes à dons",
      hits: dons
        .filter((d) => matches(q, d.title, d.description))
        .map((d) => ({ href: `/dons/${d.id}`, title: d.title, detail: d.status === "available" ? undefined : "plus disponible" })),
    },
    {
      label: "Recettes",
      hits: recipes
        .filter((r) => matches(q, r.title, r.ingredients))
        .map((r) => ({ href: `/recettes/${r.id}`, title: r.title, detail: matches(q, r.title) ? undefined : "dans les ingrédients" })),
    },
    {
      label: "Potlucks",
      hits: meals.filter((m) => matches(q, m.title, m.place)).map((m) => ({ href: `/repas/${m.id}`, title: m.title, detail: formatFrench(m.date as CalendarDate) })),
    },
    {
      label: "Agenda",
      hits: events
        .filter((e) => matches(q, e.title, e.description))
        .map((e) => ({ href: `/agenda?month=${e.date}`, title: e.title, detail: formatFrench(e.date as CalendarDate) })),
    },
    {
      label: "Membres",
      hits: members.filter((m) => matches(q, m.name)).map((m) => ({ href: `/membres/${m.id}`, title: m.name || "Membre" })),
    },
  ];
  return groups.filter((g) => g.hits.length > 0).map((g) => ({ ...g, hits: g.hits.slice(0, LIMIT) }));
}
