import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkConsole } from "@/modules/loups/scenarios/data";

export const metadata: Metadata = { title: "Répétition", robots: { index: false, follow: false } };

/**
 * A rehearsal in one window: the meneur's phone on the left, the projection on the right, both live
 * on the same evening. For simulations, and for checking anything at home with a single screen.
 */
export default async function RehearsalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkConsole(code);
  if (!check.ok && check.reason === "signed-out") redirect("/sign-in");
  if (!check.ok) redirect("/jeux/loups/scenarios");
  return (
    <main className="scn flex min-h-dvh flex-col gap-3 p-3 lg:flex-row lg:items-start">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="flex w-[390px] items-center justify-between text-xs text-[var(--scn-muted)]">
          <span className="scn-vt text-lg text-[var(--scn-ice)]">TÉLÉPHONE DU MENEUR</span>
          <Link href={`/scenario/${check.game.code}/console`} className="underline">
            Console seule
          </Link>
        </div>
        <iframe title="Console du meneur" src={`/scenario/${check.game.code}/console`} className="h-[844px] max-h-[calc(100dvh-3rem)] w-[390px] rounded-[2rem] border-8 border-black bg-black" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--scn-muted)]">
          <span className="scn-vt text-lg text-[var(--scn-ice)]">VIDÉOPROJECTEUR</span>
          <a href={`/scenario/projection/${check.game.token}`} target="_blank" rel="noopener noreferrer" className="underline">
            Ouvrir la projection seule ↗
          </a>
        </div>
        <iframe
          title="Projection"
          src={`/scenario/projection/${check.game.token}`}
          allow="microphone; fullscreen; autoplay"
          className="aspect-video w-full border border-[var(--scn-line)] bg-black"
        />
      </div>
    </main>
  );
}
