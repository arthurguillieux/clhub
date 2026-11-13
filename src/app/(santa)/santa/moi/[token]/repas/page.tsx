import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findByToken } from "@/modules/santa/data/events";
import { getMealsView } from "@/modules/santa/data/meals";
import { asTheme } from "@/modules/santa/themes";
import { MealsPage } from "../../../MealsPage";
import { santaMealsMeAction } from "../../../mealsActions";
import { SantaScene } from "../../../Scene";

// Same key as the personal page: keep it out of search engines and of the Referer.
export const metadata: Metadata = { title: "Qu'est-ce qu'on mange ?", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** A participant's way into the meals, from their personal page. */
export default async function SantaMealsMePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findByToken(token);
  if (!found || !found.event.mealsEnabled) notFound();
  const view = await getMealsView(found.event, { me: found.me.id, organizer: false });
  return (
    <SantaScene theme={asTheme(found.event.theme)} className="pb-32">
      <div className="relative mx-auto max-w-xl">
        <MealsPage initialView={view} act={santaMealsMeAction.bind(null, token)} back={{ href: `/santa/moi/${token}`, label: "Ma page" }} />
      </div>
    </SantaScene>
  );
}
