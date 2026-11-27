import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { buildView, getEditionByCode, guestOfMember, isOrganizer } from "@/modules/nouvel-an/data";
import { GuestScreen } from "../_ui/GuestScreen";
import { OrgPanel } from "../_ui/OrgPanel";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const e = await getEditionByCode((await params).code);
  return { title: e?.title ?? "Nouvel an" };
}

/** An edition: the organizers' panel for them, a member guest's own page for the others. */
export default async function EditionPage({ params }: { params: Promise<{ code: string }> }) {
  const me = (await getSession())!.member.id; // the (club) layout lets signed-in members only
  const e = await getEditionByCode((await params).code);
  if (!e) notFound();
  const organizer = await isOrganizer(e, me);
  const guest = await guestOfMember(e, me);
  if (!organizer && !guest) notFound();
  const view = await buildView(e, { organizer, memberId: me, guest });

  return (
    <Container size="md">
      <Link href="/celebrer/nouvel-an" className="-my-2 inline-block py-2 text-sm text-muted hover:text-ink">
        ← Nouvel an
      </Link>
      <div className="mt-2">
        <PageTitle section="nouvelan">{view.title}</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        {view.span}
        {view.place ? ` · ${view.place}` : ""} · organisé par {view.hostName}
        {view.cohosts.length ? `, ${view.cohosts.map((c) => c.name).join(", ")}` : ""}
      </p>
      {view.message && <p className="mt-4 text-sm whitespace-pre-wrap text-ink">« {view.message} »</p>}
      {organizer || !guest ? <OrgPanel initialView={view} /> : <GuestScreen token={guest.token} initialView={view} />}
    </Container>
  );
}
