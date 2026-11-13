import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMealsView, organizerMealsActor } from "@/modules/santa/data/meals";
import { checkOrganizer } from "@/modules/santa/host";
import { asTheme } from "@/modules/santa/themes";
import { MealsPage } from "../../MealsPage";
import { santaMealsOrgAction } from "../../mealsActions";
import { SantaScene } from "../../Scene";

export const metadata: Metadata = { title: "Secret Santa — les repas", robots: { index: false, follow: false } };

/** The meals seen from the panel: the organizers fill in for anyone, handy for those who never come to the site. */
export default async function SantaMealsOrgPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkOrganizer(code);
  if (!check.ok) redirect(check.reason === "signed-out" ? "/sign-in" : "/jeux/santa");
  if (!check.event.mealsEnabled) redirect(`/santa/${check.event.code}/panneau`);
  const view = await getMealsView(check.event, await organizerMealsActor(check.event, check.memberId));
  return (
    <SantaScene theme={asTheme(check.event.theme)} className="pb-32">
      <div className="relative mx-auto max-w-xl">
        <MealsPage
          initialView={view}
          act={santaMealsOrgAction.bind(null, check.event.code)}
          back={{ href: check.event.archivedAt ? `/santa/${check.event.code}/archive` : `/santa/${check.event.code}/panneau`, label: "Le panneau" }}
        />
      </div>
    </SantaScene>
  );
}
