import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SantaScene } from "@/app/(santa)/santa/Scene";
import { getLetterByCode, getOrgView, titleOf } from "@/modules/lettre/data/letters";
import { checkOrganizer } from "@/modules/lettre/host";
import { listMembers } from "@/modules/members/data/members";
import { JoinPrompt } from "./JoinPrompt";
import { LetterPanel } from "./LetterPanel";

export const metadata: Metadata = { title: "Lettre au Père Noël — organisation", robots: { index: false, follow: false } };

/** The organizers' page: the letter, the gifts and who gives what, the link to send, then after Christmas. */
export default async function LetterPanelPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkOrganizer(code);
  if (!check.ok && check.reason === "signed-out") redirect("/sign-in");
  const found = check.ok ? check.letter : check.reason === "not-organizer" ? await getLetterByCode(code) : null;

  return (
    <SantaScene theme="blanc" className="pb-32">
      <div className="lettre relative mx-auto max-w-2xl">
        {check.ok ? (
          <LetterPanel
            code={check.letter.code}
            initialView={await getOrgView(check.letter)}
            isCreator={check.role === "host"}
            members={(await listMembers()).map((m) => ({ id: m.id, name: m.name, isHost: m.id === check.letter.hostMemberId }))}
          />
        ) : found ? (
          <JoinPrompt code={found.code} title={titleOf(found)} hasPassword={!!found.cohostPassword} />
        ) : (
          <div className="santa-panel mt-16 p-6 text-center">
            <h1 className="santa-title text-2xl">Lettre introuvable</h1>
            <Link href="/jeux/lettre" className="santa-btn-ghost mt-4 inline-flex min-h-11 items-center px-4">
              Retour
            </Link>
          </div>
        )}
      </div>
    </SantaScene>
  );
}
