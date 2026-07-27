/**
 * Pure "who owes whom" logic for a Tricount-style expense event — no DB,
 * no I/O, exhaustively tested (see settlement.test.ts). Everything is in
 * integer cents throughout; euros only ever appear at the UI boundary.
 */

export interface Participant {
  memberId: string;
  shares: number;
}

export interface ExpenseInput {
  amountCents: number;
  paidByMemberId: string;
}

export interface SettlementInput {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

export interface Balance {
  memberId: string;
  paidCents: number;
  fairShareCents: number;
  /** paid − fair share, before netting out recorded reimbursements. Positive = owed money. */
  rawBalanceCents: number;
}

export interface SuggestedTransfer {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

/**
 * Splits `totalCents` across participants proportionally to their shares,
 * in whole cents that sum back to exactly `totalCents` — the largest-
 * remainder method, so nobody's fair share is off by a fraction of a cent
 * and the total never silently leaks a cent to rounding.
 */
export function computeFairShares(totalCents: number, participants: Participant[]): Map<string, number> {
  const totalShares = participants.reduce((sum, p) => sum + p.shares, 0);
  const result = new Map<string, number>();
  if (totalShares <= 0) {
    for (const p of participants) result.set(p.memberId, 0);
    return result;
  }

  const withRemainders = participants.map((p) => {
    const exact = (totalCents * p.shares) / totalShares;
    const floor = Math.floor(exact);
    return { memberId: p.memberId, floor, remainder: exact - floor };
  });

  const allocated = withRemainders.reduce((sum, w) => sum + w.floor, 0);
  const leftoverCents = totalCents - allocated;

  for (const w of withRemainders) result.set(w.memberId, w.floor);

  const byRemainderDesc = [...withRemainders].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < leftoverCents; i++) {
    const winner = byRemainderDesc[i % byRemainderDesc.length];
    if (!winner) break;
    result.set(winner.memberId, (result.get(winner.memberId) ?? 0) + 1);
  }

  return result;
}

/** What each participant paid vs. their fair share of the event's total. */
export function computeBalances(expenses: ExpenseInput[], participants: Participant[]): Balance[] {
  const totalCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const fairShares = computeFairShares(totalCents, participants);

  const paidByMember = new Map<string, number>();
  for (const e of expenses) {
    paidByMember.set(e.paidByMemberId, (paidByMember.get(e.paidByMemberId) ?? 0) + e.amountCents);
  }

  return participants.map((p) => {
    const paidCents = paidByMember.get(p.memberId) ?? 0;
    const fairShareCents = fairShares.get(p.memberId) ?? 0;
    return { memberId: p.memberId, paidCents, fairShareCents, rawBalanceCents: paidCents - fairShareCents };
  });
}

/** Folds recorded reimbursements into each balance: paying off a debt moves it toward zero. */
export function applySettlements(
  balances: Balance[],
  settlements: SettlementInput[],
): Map<string, number> {
  const net = new Map(balances.map((b) => [b.memberId, b.rawBalanceCents]));
  for (const s of settlements) {
    net.set(s.fromMemberId, (net.get(s.fromMemberId) ?? 0) + s.amountCents);
    net.set(s.toMemberId, (net.get(s.toMemberId) ?? 0) - s.amountCents);
  }
  return net;
}

/**
 * Greedy largest-creditor/largest-debtor matching: at each step, the
 * biggest remaining debt pays the biggest remaining credit as much as it
 * can. Produces at most n−1 transfers for n unsettled members, rather than
 * a transfer between every pair.
 */
export function suggestTransfers(netBalances: Map<string, number>): SuggestedTransfer[] {
  const creditors: { memberId: string; amount: number }[] = [];
  const debtors: { memberId: string; amount: number }[] = [];
  for (const [memberId, amount] of netBalances) {
    if (amount > 0) creditors.push({ memberId, amount });
    else if (amount < 0) debtors.push({ memberId, amount: -amount });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: SuggestedTransfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    if (!c || !d) break;
    const amount = Math.min(c.amount, d.amount);
    if (amount > 0) {
      transfers.push({ fromMemberId: d.memberId, toMemberId: c.memberId, amountCents: amount });
      c.amount -= amount;
      d.amount -= amount;
    }
    if (c.amount === 0) ci++;
    if (d.amount === 0) di++;
  }
  return transfers;
}
