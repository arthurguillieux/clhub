import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listMembers } from "@/modules/members/data/members";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { MemberList } from "./MemberList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Membres" };

export default async function MembresPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const members = await listMembers();

  return (
    <Container>
      <PageTitle>Membres</PageTitle>
      <p className="mt-2 text-sm text-muted">
        {members.length} {members.length > 1 ? "membres" : "membre"} au club.{" "}
        <Link href="/invite" className="text-primary underline underline-offset-2">
          Inviter quelqu&apos;un
        </Link>
      </p>

      <MemberList members={members} />

      {/* The year in review: a card that says what it is, not a lone heading. */}
      <Link href="/wrapped" className="mt-8 block">
        <Card className="flex items-center justify-between gap-4 p-5 transition-colors hover:border-primary">
          <div>
            <p className="glow-text-primary font-display text-2xl font-extrabold tracking-tight text-primary">CLHUB Wrapped</p>
            <p className="mt-1 text-sm text-muted">L&apos;année du club en un coup d&apos;œil : ce qu&apos;on a partagé, cuisiné, joué et fêté ensemble.</p>
          </div>
          <span aria-hidden="true" className="text-2xl text-muted">
            →
          </span>
        </Card>
      </Link>
    </Container>
  );
}
