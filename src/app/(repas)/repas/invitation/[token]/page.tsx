import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { loadMeal } from "@/app/(club)/repas/load";
import { MealScreen } from "@/app/(club)/repas/MealScreen";
import { jokeSeed } from "@/app/(club)/repas/seed";

type Props = { params: Promise<{ token: string }> };

// The link is the key: out of search engines and out of any Referer.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await loadMeal({ token: (await params).token });
  return {
    title: view ? `${view.title} · tu es invité` : "Les potlucks du CLHUB",
    description: view ? `${view.organizerName} t'invite. Dis si tu viens et ce que tu ramènes.` : undefined,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

/** A meal for guests without an account: the link the organizer sends. Same screen as in the club. */
export default async function MealInvitationPage({ params }: Props) {
  const { token } = await params;
  const view = await loadMeal({ token });
  const session = await getSession();
  return (
    <main className="repas min-h-dvh">
      <div className="relative mx-auto max-w-2xl">
        <p className="px-4 pt-5 font-display text-lg font-extrabold tracking-tight sm:px-6">
          LE CL<span className="text-primary">HUB</span> <span className="repas-muted text-sm font-semibold">· les potlucks</span>
        </p>
        {view ? (
          <MealScreen mealRef={{ token }} initial={view} seed={jokeSeed(view.me?.id ?? token)} signedIn={!!session} />
        ) : (
          <div className="repas-card m-4 p-6 text-center">
            <h1 className="repas-title text-2xl">Ce lien ne mène nulle part</h1>
            <p className="repas-muted mt-2 text-sm">Le potluck a peut-être été supprimé. Demande à la personne qui t&apos;a envoyé le lien.</p>
          </div>
        )}
      </div>
    </main>
  );
}
