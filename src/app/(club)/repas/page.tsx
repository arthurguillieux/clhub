import type { Metadata } from "next";
import Link from "next/link";
import { isAdminModeActive } from "@/core/auth/admin";
import { getSession } from "@/core/auth/session";
import { listMealsFor } from "@/modules/repas/data/meals";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";

export const metadata: Metadata = { title: "Les potlucks du CLHUB" };

const frDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });
type Meals = Awaited<ReturnType<typeof listMealsFor>>;

export default async function MealsPage() {
  const session = (await getSession())!;
  const meals = await listMealsFor(session.member.id, await isAdminModeActive());
  const upcoming = meals.filter((m) => m.upcoming);
  const past = meals.filter((m) => !m.upcoming);
  return (
    <Container>
      <div className="repas flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <PageTitle section="repas">Les potlucks du CLHUB</PageTitle>
          <p className="repas-muted max-w-prose text-sm">
            Raclettes, barbecues, crêpes et apéros : invite du monde (avec ou sans compte), dis ce qu&apos;il faut ramener, et chacun prend sa part. La calculette fait la liste de courses.
          </p>
          <Link href="/repas/nouveau" className="repas-btn self-start">
            + Organiser un potluck
          </Link>
        </header>
        <MealList title="À venir" meals={upcoming} empty="Rien au menu pour l'instant. Une raclette, peut-être ?" />
        {past.length > 0 && <MealList title="Déjà mangés" meals={past} past />}
      </div>
    </Container>
  );
}

function MealList({ title, meals, empty, past = false }: { title: string; meals: Meals; empty?: string; past?: boolean }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="repas-label">{title}</h2>
      {meals.length === 0 && empty && <p className="repas-muted text-sm">{empty}</p>}
      <ul className="flex flex-col gap-2">
        {meals.map((m) => (
          <li key={m.id}>
            <Link href={`/repas/${m.id}`} className={`repas-card flex flex-col gap-2 p-4 transition-colors hover:border-[var(--r-cheese)] ${past ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="repas-title truncate text-xl">{m.title}</p>
                  <p className="repas-muted text-sm">
                    {frDate(m.date)}
                    {m.time ? ` · ${m.time}` : ""}
                    {m.place ? ` · ${m.place}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--r-raised)] px-2.5 py-1 text-xs font-bold">{m.mine ? "tu organises" : m.invited ? "invité" : "ouvert à tous"}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="repas-muted shrink-0">
                  {m.coming} {m.coming > 1 ? "convives" : "convive"} · par {m.organizer}
                </span>
                <span className="repas-gauge h-1.5 flex-1">
                  <span style={{ width: `${m.feast}%` }} />
                </span>
                {!past && m.invited && (
                  <span className={m.myClaims ? "text-[var(--r-herb)]" : "text-[var(--r-tomato)]"}>
                    {m.myClaims ? `tu ramènes ${m.myClaims} ${m.myClaims > 1 ? "choses" : "chose"}` : "tu ne ramènes rien"}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
