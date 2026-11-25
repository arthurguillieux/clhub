import type { Metadata } from "next";
import Link from "next/link";
import { addDays, eachDay, today } from "@/core/date";
import { computeSharedAvailability, summarizeByDay } from "@/modules/agenda/data/sharedAvailability";
import { NewMealForm } from "./NewMealForm";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";

export const metadata: Metadata = { title: "Organiser un potluck" };

export default async function NewMealPage() {
  const start = today();
  const end = addDays(start, 30);
  const summaries = summarizeByDay(await computeSharedAvailability(start, end), eachDay(start, end));
  // More than one connected calendar, all free: a day worth suggesting.
  const suggested: string[] = summaries
    .filter((s) => s.countedTotal > 1 && s.freeCount === s.countedTotal)
    .slice(0, 8)
    .map((s) => s.day);
  return (
    <Container size="md">
      <div className="repas flex flex-col gap-5">
        <Link href="/repas" className="repas-muted -my-2 inline-flex min-h-11 items-center text-sm hover:text-[var(--r-ink)]">
          ← Potlucks
        </Link>
        <PageTitle section="repas">Organiser un potluck</PageTitle>
        <p className="repas-muted -mt-2 text-sm">Ensuite : les invités, et la liste de ce qu&apos;il faut ramener (la calculette peut la faire pour toi).</p>
        <NewMealForm suggested={suggested} />
      </div>
    </Container>
  );
}
