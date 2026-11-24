import type { Metadata } from "next";
import Link from "next/link";
import { addDays, eachDay, today } from "@/core/date";
import { computeSharedAvailability, summarizeByDay } from "@/modules/agenda/data/sharedAvailability";
import { NewMealForm } from "./NewMealForm";

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
    <main className="repas min-h-[calc(100dvh-4rem)]">
      <div className="relative mx-auto flex max-w-xl flex-col gap-5 px-4 pt-6 pb-12 sm:px-6">
        <Link href="/repas" className="repas-muted inline-flex min-h-11 items-center text-sm">
          ← Les potlucks du CLHUB
        </Link>
        <h1 className="repas-title text-4xl">Organiser un potluck</h1>
        <p className="repas-muted -mt-3 text-sm">Ensuite : les invités, et la liste de ce qu&apos;il faut ramener (la calculette peut la faire pour toi).</p>
        <NewMealForm suggested={suggested} />
      </div>
    </main>
  );
}
