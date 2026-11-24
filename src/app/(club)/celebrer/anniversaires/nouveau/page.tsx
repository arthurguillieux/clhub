import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { listClubMembers } from "@/modules/anniversaire/data";
import { NewBirthdayForm } from "./NewBirthdayForm";

export const metadata: Metadata = { title: "Préparer un anniversaire" };

export default async function NewBirthdayPage() {
  const me = (await getSession())!.member.id;
  const members = (await listClubMembers()).filter((m) => m.id !== me);
  return (
    <Container size="md">
      <Link href="/celebrer/anniversaires" className="-my-2 inline-block py-2 text-sm text-muted hover:text-ink">
        ← Anniversaires
      </Link>
      <div className="mt-2">
        <PageTitle section="anniversaire">Préparer un anniversaire</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">Le cadeau se choisit à plusieurs, dans le dos de la personne fêtée : chacun propose des idées, met des pouces, et le prix se partage à parts égales.</p>
      <Card className="mt-6 p-5 sm:p-6">
        <NewBirthdayForm members={members} />
      </Card>
    </Container>
  );
}
