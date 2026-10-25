import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getGameByCode, getHostView } from "@/modules/killer/data/games";
import { listMembers } from "@/modules/members/data/members";
import { checkKillerHost } from "@/modules/killer/host";
import { HostPanel } from "./HostPanel";
import { JoinPrompt } from "./JoinPrompt";

export const metadata: Metadata = { title: "Killer — panneau", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#080505" };

/** The organizer's phone: preparation, then eliminations. Outside the club layout so it fills the screen. */
export default async function KillerPanelPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkKillerHost(code);
  if (!check.ok) {
    if (check.reason === "signed-out") redirect("/sign-in");
    if (check.reason === "not-host") {
      const game = await getGameByCode(code);
      if (game) return <JoinPrompt code={game.code} title={game.title} hasPassword={!!game.cohostPassword} />;
    }
    return (
      <main className="killer flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="killer-title text-2xl">{check.reason === "missing" ? "Partie introuvable" : "Pas ta partie"}</h1>
        <Link href="/jeux/killer" className="killer-btn-ghost px-4 py-3">
          Retour
        </Link>
      </main>
    );
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  // A game filed away is only consulted now.
  if (check.game.archivedAt) redirect(`/killer/${check.game.code}/archive`);
  const isCreator = check.role === "host";
  // The creator picks co-organizers among the club's members (everyone but themselves).
  const members = isCreator ? (await listMembers()).filter((m) => m.id !== check.memberId).map((m) => ({ id: m.id, name: m.name })) : [];
  return (
    <HostPanel
      code={check.game.code}
      initialView={await getHostView(check.game)}
      joinUrl={`${appUrl}/killer/${check.game.code}`}
      isCreator={isCreator}
      members={members}
    />
  );
}
