import type { Metadata } from "next";
import Link from "next/link";
import { isAdminModeActive } from "@/core/auth/admin";
import { loadMeal } from "../load";
import { MealScreen } from "../MealScreen";
import { jokeSeed } from "../seed";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await loadMeal({ id: (await params).id });
  return { title: view ? view.title : "Les potlucks du CLHUB" };
}

export default async function MealPage({ params }: Props) {
  const { id } = await params;
  const view = await loadMeal({ id });
  return (
    <main className="repas min-h-[calc(100dvh-4rem)]">
      <div className="relative mx-auto max-w-2xl">
        <Link href="/repas" className="repas-muted inline-flex min-h-11 items-center px-4 pt-3 text-sm sm:px-6">
          ← Les potlucks du CLHUB
        </Link>
        {view ? (
          <MealScreen mealRef={{ id }} initial={view} seed={jokeSeed(view.me?.id ?? id)} signedIn admin={await isAdminModeActive()} />
        ) : (
          <div className="repas-card m-4 p-6 text-center">
            <h1 className="repas-title text-2xl">Ce repas n&apos;est pas pour toi</h1>
            <p className="repas-muted mt-2 text-sm">Il a été supprimé, ou il est sur invitation. Demande à celui ou celle qui l&apos;organise.</p>
          </div>
        )}
      </div>
    </main>
  );
}
