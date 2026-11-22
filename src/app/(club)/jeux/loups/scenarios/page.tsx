import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Card } from "@/core/ui/components/Card";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { SCENARIOS } from "@/modules/loups/scenarios";
import { listEvenings, liveRealEvening, unlockedScenarios } from "@/modules/loups/scenarios/data";
import { START_POINTS } from "@/modules/loups/scenarios/simulate";
import { DeleteSimulationsButton, NewEveningButton, SimulateForm, UnlockForm } from "./ScenarioForms";

export const metadata: Metadata = { title: "Loups-garous — scénarios spéciaux" };

const STATUS: Record<string, string> = { setup: "station ouverte", live: "partie en cours", done: "terminée" };
const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

/** Scenarised evenings: each opens with its own password, then stays open for the member who typed it. */
export default async function ScenariosPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx
  const [open, evenings, busyReal] = await Promise.all([unlockedScenarios(session.member.id), listEvenings(session.member.id), liveRealEvening(session.member.id)]);
  const real = evenings.filter((e) => !e.simulated);
  const simulations = evenings.filter((e) => e.simulated);
  const row = (e: (typeof evenings)[number]) => (
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
  );
  return (
    <Container size="sm">
      <Link href="/jeux/loups" className="text-sm font-medium text-muted hover:text-ink">
        ← Loups-garous
      </Link>
      <div className="mt-2">
        <PageTitle>Scénarios spéciaux</PageTitle>
      </div>
      <p className="mt-2 text-sm text-muted">
        Des soirées de Loups-garous mises en scène. Le meneur ouvre d&apos;abord la station (le décor : ses portes, ses lumières, ses écrans) et la pilote depuis son téléphone, puis y charge le scénario. Un écran projeté montre tout à la salle. Chaque scénario s&apos;ouvre avec son mot de passe.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {SCENARIOS.map((s) => (
          <Card key={s.id} className="p-5">
            <p className="font-display text-xl font-bold text-ink">{s.title}</p>
            <p className="text-sm text-muted">{s.subtitle}</p>
            <div className="mt-4 flex flex-col gap-4">
              {open.includes(s.id) ? (
                <>
                  <NewEveningButton scenarioId={s.id} baseName={s.base.name} />
                  <SimulateForm scenarioId={s.id} starts={[...START_POINTS]} blocked={busyReal} />
                </>
              ) : (
                <UnlockForm scenarioId={s.id} />
              )}
            </div>
          </Card>
        ))}
      </div>
      {real.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Tes soirées</SectionTitle>
          <div className="mt-3 flex flex-col gap-2">{real.map(row)}</div>
        </section>
      )}
      {simulations.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Simulations</SectionTitle>
          <p className="mt-1 text-sm text-muted">Des soirées fictives, pour visiter ou répéter. Elles ne comptent nulle part.</p>
          <div className="mt-3 flex flex-col gap-2">{simulations.map(row)}</div>
          <div className="mt-3">
            <DeleteSimulationsButton count={simulations.length} />
          </div>
        </section>
      )}
    </Container>
  );
}
