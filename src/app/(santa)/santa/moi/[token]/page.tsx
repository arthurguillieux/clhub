import type { Metadata } from "next";
import { getMeView } from "@/modules/santa/data/events";
import { Garland, Snow } from "../../Snow";
import { MyPage } from "./MyPage";

// The link is the key to this page: keep it out of search engines and of the Referer sent to other sites.
export const metadata: Metadata = { title: "Secret Santa", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** A participant's personal page, reached through their mail: no account needed, members or not. */
export default async function SantaMePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getMeView(token);
  return (
    <main className="santa relative min-h-dvh overflow-x-clip px-4 pt-12 pb-16">
      <Snow />
      <Garland />
      <div className="relative mx-auto max-w-xl">
        {view ? (
          <MyPage token={token} initialView={view} />
        ) : (
          <div className="santa-panel mt-16 p-6 text-center">
            <h1 className="santa-title text-2xl">Ce lien ne mène nulle part</h1>
            <p className="mt-2 text-sm text-[var(--s-muted)]">Ce Secret Santa a peut-être été supprimé. Demande à la personne qui l&apos;organise.</p>
          </div>
        )}
      </div>
    </main>
  );
}
