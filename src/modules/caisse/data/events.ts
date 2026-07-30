import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import {
  expenseEvent,
  eventParticipant,
  expense,
  settlementPayment,
  member,
  user,
  type ExpenseEvent,
} from "@/core/db/schema";
import {
  computeBalances,
  applySettlements,
  suggestTransfers,
  type Balance,
  type SuggestedTransfer,
} from "../domain/settlement";

export interface ParticipantInput {
  memberId: string;
  shares: number;
}

export interface MemberForEventForm {
  id: string;
  name: string;
  householdSize: number;
}

/** For the "new event" form — every member, with their default share count. */
export async function listMembersForEventForm(): Promise<MemberForEventForm[]> {
  return db
    .select({ id: member.id, name: user.name, householdSize: member.householdSize })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .orderBy(member.memberNumber);
}

export async function createExpenseEvent(
  createdById: string,
  name: string,
  participants: ParticipantInput[],
): Promise<ExpenseEvent> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(expenseEvent).values({ name, createdById }).returning();
    if (!created) throw new Error("Failed to create expense event");
    if (participants.length > 0) {
      await tx
        .insert(eventParticipant)
        .values(participants.map((p) => ({ eventId: created.id, memberId: p.memberId, shares: p.shares })));
    }
    return created;
  });
}

export interface ExpenseEventSummary extends ExpenseEvent {
  totalCents: number;
  participantCount: number;
}

export async function listExpenseEvents(): Promise<ExpenseEventSummary[]> {
  const events = await db.select().from(expenseEvent).orderBy(desc(expenseEvent.createdAt));
  if (events.length === 0) return [];

  const expenses = await db.select().from(expense);
  const participants = await db.select().from(eventParticipant);

  return events.map((ev) => ({
    ...ev,
    totalCents: expenses.filter((e) => e.eventId === ev.id).reduce((s, e) => s + e.amountCents, 0),
    participantCount: participants.filter((p) => p.eventId === ev.id).length,
  }));
}

export interface ParticipantWithName {
  memberId: string;
  name: string;
  shares: number;
}

export interface ExpenseWithNames {
  id: string;
  amountCents: number;
  description: string;
  paidByMemberId: string;
  paidByName: string;
  createdById: string;
  createdAt: Date;
}

export interface SettlementWithNames {
  id: string;
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amountCents: number;
  createdAt: Date;
}

export interface EventDetail {
  event: ExpenseEvent;
  participants: ParticipantWithName[];
  expenses: ExpenseWithNames[];
  settlements: SettlementWithNames[];
  balances: Balance[];
  suggestedTransfers: SuggestedTransfer[];
}

export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
  const [event] = await db.select().from(expenseEvent).where(eq(expenseEvent.id, eventId)).limit(1);
  if (!event) return null;

  const [participantRows, expenseRows, settlementRows] = await Promise.all([
    db
      .select({ memberId: eventParticipant.memberId, shares: eventParticipant.shares, name: user.name })
      .from(eventParticipant)
      .innerJoin(member, eq(member.id, eventParticipant.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(eventParticipant.eventId, eventId)),
    db
      .select({
        id: expense.id,
        amountCents: expense.amountCents,
        description: expense.description,
        paidByMemberId: expense.paidByMemberId,
        createdById: expense.createdById,
        createdAt: expense.createdAt,
        paidByName: user.name,
      })
      .from(expense)
      .innerJoin(member, eq(member.id, expense.paidByMemberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(expense.eventId, eventId))
      .orderBy(desc(expense.createdAt)),
    db.select().from(settlementPayment).where(eq(settlementPayment.eventId, eventId)).orderBy(desc(settlementPayment.createdAt)),
  ]);

  const nameByMemberId = new Map(participantRows.map((p) => [p.memberId, p.name]));
  const settlementsWithNames: SettlementWithNames[] = settlementRows.map((s) => ({
    id: s.id,
    fromMemberId: s.fromMemberId,
    fromName: nameByMemberId.get(s.fromMemberId) ?? "Membre",
    toMemberId: s.toMemberId,
    toName: nameByMemberId.get(s.toMemberId) ?? "Membre",
    amountCents: s.amountCents,
    createdAt: s.createdAt,
  }));

  const balances = computeBalances(
    expenseRows.map((e) => ({ amountCents: e.amountCents, paidByMemberId: e.paidByMemberId })),
    participantRows.map((p) => ({ memberId: p.memberId, shares: p.shares })),
  );
  const netBalances = applySettlements(
    balances,
    settlementRows.map((s) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amountCents: s.amountCents,
    })),
  );
  const suggestedTransfers = suggestTransfers(netBalances);

  return {
    event,
    participants: participantRows,
    expenses: expenseRows,
    settlements: settlementsWithNames,
    balances,
    suggestedTransfers,
  };
}

export async function getEventOwnerId(eventId: string): Promise<string | null> {
  const [row] = await db.select({ createdById: expenseEvent.createdById }).from(expenseEvent).where(eq(expenseEvent.id, eventId)).limit(1);
  return row?.createdById ?? null;
}

export async function updateExpenseEvent(eventId: string, name: string): Promise<void> {
  await db.update(expenseEvent).set({ name }).where(eq(expenseEvent.id, eventId));
}

/** No cascade on the FKs into expense_event — clear children before the event itself. */
export async function deleteExpenseEvent(eventId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(settlementPayment).where(eq(settlementPayment.eventId, eventId));
    await tx.delete(expense).where(eq(expense.eventId, eventId));
    await tx.delete(eventParticipant).where(eq(eventParticipant.eventId, eventId));
    await tx.delete(expenseEvent).where(eq(expenseEvent.id, eventId));
  });
}

export interface AddExpenseInput {
  amountCents: number;
  description: string;
  paidByMemberId: string;
  createdById: string;
}

export async function addExpense(eventId: string, input: AddExpenseInput): Promise<void> {
  await db.insert(expense).values({ eventId, ...input });
}

export async function getExpenseById(
  expenseId: string,
): Promise<{ id: string; eventId: string; createdById: string } | null> {
  const [row] = await db
    .select({ id: expense.id, eventId: expense.eventId, createdById: expense.createdById })
    .from(expense)
    .where(eq(expense.id, expenseId))
    .limit(1);
  return row ?? null;
}

export interface UpdateExpenseInput {
  amountCents: number;
  description: string;
  paidByMemberId: string;
}

export async function updateExpense(expenseId: string, input: UpdateExpenseInput): Promise<void> {
  await db.update(expense).set(input).where(eq(expense.id, expenseId));
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await db.delete(expense).where(eq(expense.id, expenseId));
}

export async function deleteSettlement(settlementId: string): Promise<void> {
  await db.delete(settlementPayment).where(eq(settlementPayment.id, settlementId));
}

export async function recordSettlement(
  eventId: string,
  input: { fromMemberId: string; toMemberId: string; amountCents: number },
): Promise<void> {
  await db.insert(settlementPayment).values({ eventId, ...input });
}
