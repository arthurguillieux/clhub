import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { getBirthdayView, longDate } from "@/modules/anniversaire/data";
import { BirthdayScreen } from "./BirthdayScreen";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const me = (await getSession())?.member.id;
  const view = me ? await getBirthdayView((await params).id, me) : null;
  return { title: view ? `Anniversaire de ${view.name}` : "Anniversaires" };
}

/**
 * A birthday's page. For anyone not in on it, and above all for the person celebrated, it simply
 * doesn't exist: the same « page introuvable » as a wrong address, nothing that hints at a surprise.
 */
export default async function BirthdayPage({ params }: { params: Promise<{ id: string }> }) {
  const me = (await getSession())!.member.id;
  const view = await getBirthdayView((await params).id, me);
  if (!view) notFound();

  return (
    <Container size="md">
      <Link href="/celebrer/anniversaires" className="-my-2 inline-block py-2 text-sm text-muted hover:text-ink">
        ← Anniversaires
      </Link>
      <div className="mt-2">
        <PageTitle section="anniversaire">Anniversaire de {view.name}</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        {longDate(view.date)} · organisé par {view.isCreator ? "toi" : view.creatorName}
      </p>
      <p className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-ink">
        🤫 C&apos;est une surprise{view.honoreeIsMember ? ` : ${view.name} ne voit ni cette page, ni les notifications, ni les mails.` : " : pas un mot !"}
      </p>
      {view.note && <p className="mt-4 text-sm whitespace-pre-wrap text-ink">« {view.note} »</p>}
      <BirthdayScreen view={view} />
    </Container>
  );
}
