import type { Metadata } from "next";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Signaler un bug" };

/** « Signaler un bug »: a member says what went wrong; the page they came from is already noted. */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const from = typeof page === "string" && /^\/[^\s]{0,299}$/.test(page) && !page.startsWith("/signaler") ? page : "";
  return (
    <Container size="sm">
      <PageTitle>Signaler un bug</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Quelque chose ne marche pas comme prévu ? Dis ce que tu faisais et ce qui s&apos;est passé. Arthur reçoit ton message tout de suite, et regarde avec Claude ce qui cloche.
      </p>
      <ReportForm page={from} />
    </Container>
  );
}
