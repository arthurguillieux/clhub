import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listExpenseEvents } from "@/modules/caisse/data/events";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { LinkButton } from "@/core/ui/components/Button";

function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export default async function CaissePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const events = await listExpenseEvents();

  return (
    <Container>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Caisse commune</PageTitle>
        <LinkButton href="/caisse/new" variant="accent">
          + Nouvel évènement
        </LinkButton>
      </div>
      <p className="mt-2 text-sm text-muted">
        Chaque évènement (un weekend, un camping...) a ses propres dépenses — personne n&apos;avance
        dans un pot commun, on calcule qui doit quoi à qui à la fin.
      </p>

      <div className="mt-8">
        {events.length === 0 ? (
          <p className="text-sm text-muted">Aucun évènement pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((ev) => (
              <li key={ev.id}>
                <Link href={`/caisse/${ev.id}`}>
                  <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-primary">
                    <div>
                      <p className="font-display text-base font-extrabold text-ink">{ev.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {ev.participantCount} participant{ev.participantCount > 1 ? "s" : ""} ·{" "}
                        {ev.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold tabular-nums text-ink">
                      {euros(ev.totalCents)}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
