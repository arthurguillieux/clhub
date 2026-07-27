import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { caisseTransaction, member, user, type CaisseTransaction } from "@/core/db/schema";

export type TransactionType = "contribution" | "expense";

export interface CreateTransactionInput {
  type: TransactionType;
  amountCents: number;
  description: string;
}

export async function createTransaction(
  memberId: string,
  input: CreateTransactionInput,
): Promise<CaisseTransaction> {
  const [created] = await db
    .insert(caisseTransaction)
    .values({ memberId, ...input })
    .returning();
  if (!created) throw new Error("Failed to create transaction");
  return created;
}

export interface TransactionWithMember extends CaisseTransaction {
  memberName: string;
}

/** Most recent first — the balance is just the running sum, computed from this same list. */
export async function listTransactions(): Promise<TransactionWithMember[]> {
  const rows = await db
    .select({ caisseTransaction, memberName: user.name })
    .from(caisseTransaction)
    .innerJoin(member, eq(member.id, caisseTransaction.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .orderBy(desc(caisseTransaction.createdAt));

  return rows.map((r) => ({ ...r.caisseTransaction, memberName: r.memberName }));
}

export function computeBalanceCents(transactions: { type: string; amountCents: number }[]): number {
  return transactions.reduce(
    (total, t) => total + (t.type === "contribution" ? t.amountCents : -t.amountCents),
    0,
  );
}
