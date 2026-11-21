import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buzzerQrSvg } from "@/core/qrcode";
import { getHostView, playerBook } from "@/modules/loups/data/games";
import { checkMeneur } from "@/modules/loups/host";
import { listMembers } from "@/modules/members/data/members";
import { MeneurPanel } from "./MeneurPanel";

export const metadata: Metadata = { title: "Loups-garous — meneur", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#0e1220" };

/** The meneur's phone: the table and the deck, then the nights and days, then the next game. */
export default async function MeneurPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkMeneur(code);
  if (!check.ok && check.reason === "signed-out") redirect("/sign-in");
  if (!check.ok)
    return (
      <main className="loups flex items-center justify-center px-4">
        <div className="loups-panel max-w-sm p-6 text-center">
          <h1 className="loups-title text-2xl">{check.reason === "missing" ? "Partie introuvable" : "Ce n'est pas ta partie"}</h1>
          <p className="loups-muted mt-2 text-sm">Seul le meneur ouvre cette page. Les joueurs passent par le lien ou le QR code qu&apos;il partage.</p>
          <Link href="/jeux/loups" className="loups-btn-ghost mt-4 inline-flex min-h-11 px-4">
            Retour
          </Link>
        </div>
      </main>
    );
  const view = await getHostView(check.game);
  const [book, members, qrSvg] = await Promise.all([playerBook(check.memberId), listMembers(), buzzerQrSvg(view.link)]);
  return (
    <main>
      <MeneurPanel code={check.game.code} initialView={view} book={book} members={members.map((m) => ({ id: m.id, name: m.name }))} qrSvg={qrSvg} />
    </main>
  );
}
