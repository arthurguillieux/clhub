import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buzzerQrSvg } from "@/core/qrcode";
import { listMembers } from "@/modules/members/data/members";
import { checkConsole, getConsoleView } from "@/modules/loups/scenarios/data";
import { Console } from "./Console";

export const metadata: Metadata = { title: "Console du scénario", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#0c1218" };

/** The meneur's phone during a scenario evening: preparation, then the whole evening. */
export default async function ConsolePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkConsole(code);
  if (!check.ok && check.reason === "signed-out") redirect("/sign-in");
  if (!check.ok)
    return (
      <main className="scn flex items-center justify-center px-4">
        <div className="scn-sec max-w-sm p-6 text-center">
          <h1 className="scn-vt text-3xl text-[var(--scn-ice)]">{check.reason === "missing" ? "SOIRÉE INTROUVABLE" : "ACCÈS REFUSÉ"}</h1>
          <p className="mt-2 text-sm text-[var(--scn-muted)]">Seuls le meneur et ses co-organisateurs ouvrent cette console.</p>
          <Link href="/jeux/loups/scenarios" className="scn-btn mt-4 inline-flex items-center px-4">
            Retour
          </Link>
        </div>
      </main>
    );
  const view = await getConsoleView(check.game, check.def, check.role);
  const { passwordSha256, ...def } = check.def;
  void passwordSha256;
  const [members, qrSvg] = await Promise.all([listMembers(), buzzerQrSvg(view.link)]);
  return (
    <main className="scn">
      <Console code={check.game.code} def={def} initialView={view} members={members.map((m) => ({ id: m.id, name: m.name }))} qrSvg={qrSvg} />
    </main>
  );
}
