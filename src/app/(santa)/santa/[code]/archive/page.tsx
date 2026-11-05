import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrgView } from "@/modules/santa/data/events";
import { checkOrganizer } from "@/modules/santa/host";
import { SantaScene } from "../../Scene";
import { ArchiveTools } from "./ArchiveTools";

export const metadata: Metadata = { title: "Secret Santa — archive", robots: { index: false, follow: false } };

const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

/** A past Secret Santa: who took part, under which rules, and the way to do it again next year. */
export default async function SantaArchivePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkOrganizer(code);
  if (!check.ok) redirect(check.reason === "signed-out" ? "/sign-in" : "/jeux/santa");
  if (!check.event.archivedAt) redirect(`/santa/${check.event.code}/panneau`);

  const v = await getOrgView(check.event);
  return (
    <SantaScene theme={v.theme} className="pb-24">
      <div className="relative mx-auto flex max-w-2xl flex-col gap-5">
        <header>
          <Link href="/jeux/santa" className="text-sm text-[var(--s-muted)] hover:text-[var(--s-ink)]">
            ← Secret Santa
          </Link>
          <p className="santa-label mt-3">Archivé · code {v.code}</p>
          <h1 className="santa-title mt-1 text-3xl">{v.title}</h1>
          {(v.exchangeDate || v.budget) && (
            <p className="mt-1 text-sm text-[var(--s-muted)]">
              {v.exchangeDate && `Échange le ${day.format(new Date(`${v.exchangeDate}T00:00:00Z`))}`}
              {v.exchangeDate && v.budget && " · "}
              {v.budget && `Budget : ${v.budget}`}
            </p>
          )}
        </header>

        <section className="santa-panel p-4">
          <p className="santa-label">Participants ({v.participants.length})</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {v.participants.map((p) => (
              <li key={p.id} className="rounded-full border border-[var(--s-line)] px-3 py-1 text-sm">
                {p.name}
              </li>
            ))}
          </ul>
        </section>

        {v.exclusions.length > 0 && (
          <section className="santa-panel p-4">
            <p className="santa-label">Règles d&apos;exclusion</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {v.exclusions.map((r) => (
                <li key={r.id}>{r.mutual ? `${r.fromName} et ${r.toName} ne pouvaient pas se tirer` : `${r.fromName} ne pouvait pas tirer ${r.toName}`}</li>
              ))}
            </ul>
          </section>
        )}

        <ArchiveTools code={v.code} isCreator={check.role === "host"} />
      </div>
    </SantaScene>
  );
}
