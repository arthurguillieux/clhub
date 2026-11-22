import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Card } from "@/core/ui/components/Card";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { SCENARIOS } from "@/modules/loups/scenarios";
import { listEvenings, unlockedScenarios } from "@/modules/loups/scenarios/data";
import { NewEveningButton, UnlockForm } from "./ScenarioForms";

export const metadata: Metadata = { title: "Loups-garous — scénarios spéciaux" };

const STATUS: Record<string, string> = { setup: "en préparation", live: "en cours", done: "terminée" };
const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

/** Scenarised evenings: each opens with its own password, then stays open for the member who typed it. */
export default async function ScenariosPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx
  const [open, evenings] = await Promise.all([unlockedScenarios(session.member.id), listEvenings(session.member.id)]);
  return (
    <Container size="sm">
      <Link href="/jeux/loups" className="text-sm font-medium text-muted hover:text-ink">
        ← Loups-garous
      </Link>
      <div className="mt-2">
        <PageTitle>Scénarios spéciaux</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        Des soirées de Loups-garous mises en scène : le meneur pilote depuis son téléphone, un écran projeté montre le décor. Chaque scénario s&apos;ouvre avec son mot de passe.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {SCENARIOS.map((s) => (
          <Card key={s.id} className="p-5">
            <p className="font-display text-xl font-bold text-ink">{s.title}</p>
            <p className="text-sm text-muted">{s.subtitle}</p>
            <div className="mt-4">{open.includes(s.id) ? <NewEveningButton scenarioId={s.id} /> : <UnlockForm scenarioId={s.id} />}</div>
          </Card>
        ))}
      </div>
      {evenings.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Tes soirées</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">
            {evenings.map((e) => (
              <Card key={e.code} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-display font-bold text-ink">
                    {SCENARIOS.find((s) => s.id === e.scenarioId)?.title ?? e.scenarioId} · {day(e.createdAt)}
                  </p>
                  <p className="text-xs text-muted">
                    {((e.setup as { players?: unknown[] }).players ?? []).length} joueurs · {STATUS[e.status] ?? e.status}
                  </p>
                </div>
                <Link href={`/scenario/${e.code}/console`} className="-my-2.5 py-2.5 text-sm font-semibold text-primary hover:underline">
                  Ouvrir la console
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
