import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { getEventDetail } from "@/modules/caisse/data/events";
import { applySettlements, suggestTransfers } from "@/modules/caisse/domain/settlement";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { AddExpenseForm } from "./AddExpenseForm";
import { RecordSettlementForm } from "./RecordSettlementForm";
import { QuickSettleButton } from "./QuickSettleButton";

function euros(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  return `${sign}${(Math.abs(cents) / 100).toFixed(2)} €`;
}

export default async function ExpenseEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) notFound();

  const nameByMemberId = new Map(detail.participants.map((p) => [p.memberId, p.name]));
  const netBalances = applySettlements(
    detail.balances,
    detail.settlements.map((s) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amountCents: s.amountCents,
    })),
  );
  const suggestions = suggestTransfers(netBalances);
  const totalCents = detail.expenses.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <Container>
      <Link href="/caisse" className="text-sm font-medium text-muted hover:text-ink">
        ← Caisse commune
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <PageTitle>{detail.event.name}</PageTitle>
        <p className="font-mono text-lg font-semibold tabular-nums text-ink">{euros(totalCents)}</p>
      </div>

      <section className="mt-6">
        <SectionTitle>Qui doit quoi</SectionTitle>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {detail.balances.map((b) => {
            const net = netBalances.get(b.memberId) ?? 0;
            const settled = Math.abs(net) < 1; // sub-cent noise only
            return (
              <Card key={b.memberId} className="p-4">
                <p className="font-display text-sm font-extrabold text-ink">
                  {nameByMemberId.get(b.memberId) ?? "Membre"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  A payé {euros(b.paidCents)} · part équitable {euros(b.fairShareCents)}
                </p>
                <p
                  className={`mt-2 font-mono text-sm font-semibold tabular-nums ${
                    settled
                      ? "text-muted"
                      : net > 0
                        ? "glow-text-primary text-primary"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {settled ? "Réglé" : net > 0 ? `Doit recevoir ${euros(net)}` : `Doit ${euros(-net)}`}
                </p>
              </Card>
            );
          })}
        </div>

        {suggestions.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <Card key={i} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <p className="text-sm text-ink">
                  <span className="font-semibold">{nameByMemberId.get(s.fromMemberId) ?? "Membre"}</span>{" "}
                  doit verser{" "}
                  <span className="font-mono font-semibold tabular-nums">{euros(s.amountCents)}</span> à{" "}
                  <span className="font-semibold">{nameByMemberId.get(s.toMemberId) ?? "Membre"}</span>
                </p>
                <QuickSettleButton
                  eventId={id}
                  fromMemberId={s.fromMemberId}
                  toMemberId={s.toMemberId}
                  amountCents={s.amountCents}
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle>Ajouter une dépense</SectionTitle>
        <Card className="mt-3 p-4">
          <AddExpenseForm
            eventId={id}
            participants={detail.participants}
            currentMemberId={session.member.id}
          />
        </Card>
      </section>

      <section className="mt-8">
        <SectionTitle>Dépenses</SectionTitle>
        {detail.expenses.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Rien pour l&apos;instant.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {detail.expenses.map((e) => (
              <Card key={e.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{e.description}</p>
                  <p className="text-xs text-muted">Payé par {e.paidByName}</p>
                </div>
                <p className="font-mono text-sm font-semibold tabular-nums text-ink">{euros(e.amountCents)}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle>Enregistrer un remboursement</SectionTitle>
        <p className="mt-1 text-sm text-muted">
          Pour un montant qui ne correspond pas exactement à une suggestion ci-dessus.
        </p>
        <Card className="mt-3 p-4">
          <RecordSettlementForm eventId={id} participants={detail.participants} />
        </Card>
        {detail.settlements.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {detail.settlements.map((s) => (
              <Card key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <p className="text-ink">
                  {s.fromName} → {s.toName}
                </p>
                <p className="font-mono font-semibold tabular-nums text-ink">{euros(s.amountCents)}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
