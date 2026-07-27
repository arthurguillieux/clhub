"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { logActivity } from "@/core/activity";
import { createTransaction } from "@/modules/caisse/data/transactions";

const createSchema = z.object({
  type: z.enum(["contribution", "expense"]),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0.").max(100000),
  description: z.string().trim().min(1, "Précise à quoi correspond ce mouvement.").max(300),
});

export type CreateTransactionState = { status: "idle" } | { status: "error"; message: string };

export async function createTransactionAction(
  _prevState: CreateTransactionState,
  formData: FormData,
): Promise<CreateTransactionState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };

  const parsed = createSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const amountCents = Math.round(parsed.data.amount * 100);
  const created = await createTransaction(session.member.id, {
    type: parsed.data.type,
    amountCents,
    description: parsed.data.description,
  });

  await logActivity({
    section: "caisse",
    kind: parsed.data.type === "contribution" ? "caisse.contribution" : "caisse.expense",
    actorId: session.member.id,
    subjectRef: `caisse:${created.id}`,
    payload: { amountCents, description: created.description },
  });

  redirect("/caisse");
}
