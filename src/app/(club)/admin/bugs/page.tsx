import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/admin";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { listBugReports, recentServerErrors } from "@/modules/bugs/data";
import { BugList, CopyForClaude } from "./BugList";

export const metadata: Metadata = { title: "Signalements · Admin" };

/** The members' reports, sorted out with Claude; and what the server itself says went wrong. */
export default async function AdminBugsPage() {
  await requireAdmin();
  const [reports, errors] = await Promise.all([listBugReports(), recentServerErrors()]);
  const when = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  return (
    <Container>
      <Link href="/admin" className="text-sm font-medium text-muted hover:text-ink">
        ← Admin
      </Link>
      <div className="mt-2">
        <PageTitle>Signalements</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        Ce que les membres signalent avec « Signaler un bug ». Donne ton verdict (bug, pas un bug, corrigé), puis « Copier pour Claude » : le résumé des signalements ouverts et des dernières
        erreurs du serveur, à coller dans la conversation.
      </p>
      <div className="mt-4">
        <CopyForClaude />
      </div>
      <section className="mt-8">
        <SectionTitle>Les signalements</SectionTitle>
        <BugList
          reports={reports.map((r) => ({ id: r.id, page: r.page, message: r.message, userAgent: r.userAgent, status: r.status, note: r.note, name: r.name, when: when(r.createdAt) }))}
        />
      </section>
      <section className="mt-10">
        <SectionTitle>Les dernières erreurs du serveur</SectionTitle>
        <p className="mt-1 text-sm text-muted">Ce que le serveur a enregistré de lui-même : utile quand quelqu&apos;un voit « recharge la page » ou une page d&apos;erreur.</p>
        {errors.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aucune erreur enregistrée.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {errors.map((e) => (
              <li key={e.id} className="rounded-md border border-line bg-surface-raised p-3">
                <p className="text-xs text-muted">
                  {when(e.occurredAt)} · {e.method} {e.path} · {e.routeType}
                </p>
                <p className="mt-1 font-mono text-xs break-words text-ink">{e.message}</p>
                {e.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted">La trace</summary>
                    <pre className="mt-1 overflow-x-auto text-[11px] text-muted">{e.stack}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
