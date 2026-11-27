import type { Metadata } from "next";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { buildView, findByToken } from "@/modules/nouvel-an/data";
import { GuestScreen } from "../../../(club)/celebrer/nouvel-an/_ui/GuestScreen";

// The link is the key to this page: keep it out of search engines and of the Referer sent to other sites.
export const metadata: Metadata = { title: "Nouvel an", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** A guest's personal page, reached through their mail: no account needed, members or not. */
export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findByToken(token);
  if (!found)
    return (
      <Container size="sm">
        <div className="mt-16 text-center">
          <h1 className="font-display text-2xl font-extrabold text-ink">Ce lien ne mène nulle part</h1>
          <p className="mt-2 text-sm text-muted">Ce nouvel an a peut-être été supprimé, ou ton invitation retirée. Demande à ceux qui l&apos;organisent.</p>
        </div>
      </Container>
    );
  const view = await buildView(found.edition, { organizer: false, memberId: found.guest.memberId, guest: found.guest });
  const when = view.span.charAt(0).toUpperCase() + view.span.slice(1);
  return (
    <Container size="md">
      <p className="font-display text-lg font-extrabold tracking-tight text-ink">
        LE CL<span className="text-primary">HUB</span>
      </p>
      <div className="mt-4">
        <PageTitle section="nouvelan">{view.title}</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        Bonjour {found.guest.name.split(" ")[0]} ! {when}
        {view.place ? `, ${view.place}` : ""}. Organisé par {view.hostName}
        {view.cohosts.length ? `, ${view.cohosts.map((c) => c.name).join(", ")}` : ""}.
      </p>
      {view.message && <p className="mt-4 text-sm whitespace-pre-wrap text-ink">« {view.message} »</p>}
      <div className="pb-20">
        <GuestScreen token={token} initialView={view} />
      </div>
    </Container>
  );
}
