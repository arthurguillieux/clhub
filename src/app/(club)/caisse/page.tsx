import { getSession } from "@/core/auth/session";
import { listTransactions, computeBalanceCents } from "@/modules/caisse/data/transactions";
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

  const transactions = await listTransactions();
  const balanceCents = computeBalanceCents(transactions);

  return (
    <Container>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Caisse commune</PageTitle>
        <LinkButton href="/caisse/new" variant="accent">
          + Ajouter un mouvement
        </LinkButton>
      </div>

      <Card className="mt-6 p-6">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Solde actuel</p>
        <p
          className={`mt-2 font-display text-4xl font-extrabold tabular-nums ${
            balanceCents < 0 ? "text-red-600 dark:text-red-400" : "text-ink"
          }`}
        >
          {euros(balanceCents)}
        </p>
      </Card>

      <div className="mt-8">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted">Rien dans le journal pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transactions.map((t) => {
              const isContribution = t.type === "contribution";
              return (
                <li key={t.id}>
                  <Card className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">{t.description}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {t.memberName} ·{" "}
                        {t.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <p
                      className={`font-mono text-sm font-semibold tabular-nums ${
                        isContribution ? "text-green-700 dark:text-green-400" : "text-ink"
                      }`}
                    >
                      {isContribution ? "+" : "−"}
                      {euros(t.amountCents)}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Container>
  );
}
