import type { Metadata } from "next";
import { SantaScene } from "@/app/(santa)/santa/Scene";
import { getFamilyView, getLetterByToken } from "@/modules/lettre/data/letters";
import { organizerOf } from "@/modules/lettre/host";
import { de } from "@/modules/santa/words";
import { readVisitorKey } from "../../visitor";
import { FamilyPage } from "./FamilyPage";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// The link is the key: out of search engines, and out of the Referer sent to the shops the gifts link to.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await getLetterByToken((await params).token);
  return {
    title: found ? `La lettre ${de(found.childName)} au Père Noël` : "Lettre au Père Noël",
    description: found ? `${found.childName} a écrit sa lettre au Père Noël. Ouvrez-la pour voir sa liste de cadeaux.` : undefined,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

/** The family's page, reached through the one link the organizers send: no account needed. `?enfant` opens it for the child. */
export default async function FamilyLetterPage({ params, searchParams }: Props) {
  const { token } = await params;
  const childMode = (await searchParams).enfant !== undefined;
  const found = await getLetterByToken(token);
  const preview = !!found && !found.sharedAt;
  const allowed = !!found && (!preview || (await organizerOf(found)));

  return (
    <SantaScene theme="blanc" className="pb-24">
      <div className="lettre relative mx-auto max-w-xl">
        {found && allowed ? (
          <FamilyPage token={token} initialView={await getFamilyView(found, await readVisitorKey(), preview)} childMode={childMode} />
        ) : (
          <div className="santa-panel mt-16 p-6 text-center">
            <h1 className="santa-title text-2xl">{found ? "Cette lettre n'est pas encore prête" : "Ce lien ne mène nulle part"}</h1>
            <p className="mt-2 text-sm text-[var(--s-muted)]">
              {found
                ? "Elle arrive bientôt : la personne qui vous a envoyé le lien y met la dernière main."
                : "Cette lettre a peut-être été supprimée. Demandez à la personne qui vous a envoyé le lien."}
            </p>
          </div>
        )}
      </div>
    </SantaScene>
  );
}
