import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventByCode, getOrgView } from "@/modules/santa/data/events";
import { checkOrganizer } from "@/modules/santa/host";
import { asTheme } from "@/modules/santa/themes";
import { listMembers } from "@/modules/members/data/members";
import { SantaScene } from "../../Scene";
import { JoinPrompt } from "./JoinPrompt";
import { OrgPanel } from "./OrgPanel";

export const metadata: Metadata = { title: "Secret Santa — organisation", robots: { index: false, follow: false } };

/** The organizers' page: settings, participants, exclusions, then the launch. The draw itself never shows here, unless it's unmasked. */
export default async function SantaPanelPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkOrganizer(code);
  if (!check.ok && check.reason === "signed-out") redirect("/sign-in");
  if (check.ok && check.event.archivedAt) redirect(`/santa/${check.event.code}/archive`);
  const event = check.ok ? check.event : check.reason === "not-organizer" ? await getEventByCode(code) : null;

  return (
    <SantaScene theme={asTheme(event?.theme ?? "neon")} className="pb-32">
      <div className="relative mx-auto max-w-2xl">
        {check.ok ? (
          <OrgPanel
            code={check.event.code}
            initialView={await getOrgView(check.event)}
            isCreator={check.role === "host"}
            members={(await listMembers()).map((m) => ({ id: m.id, name: m.name, isHost: m.id === check.event.hostMemberId }))}
          />
        ) : event ? (
          <JoinPrompt code={event.code} title={event.title} hasPassword={!!event.cohostPassword} />
        ) : (
          <div className="santa-panel mt-16 p-6 text-center">
            <h1 className="santa-title text-2xl">Secret Santa introuvable</h1>
            <Link href="/jeux/santa" className="santa-btn-ghost mt-4 inline-flex min-h-11 items-center px-4">
              Retour
            </Link>
          </div>
        )}
      </div>
    </SantaScene>
  );
}
