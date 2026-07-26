"use server";

import { getMailClient, requireMailFrom } from "@/core/mail/client";
import { TestEmail } from "@/core/mail/templates/TestEmail";

export async function sendTestEmail(recipientEmail: string) {
  const { data, error } = await getMailClient().emails.send({
    from: requireMailFrom(),
    to: recipientEmail,
    subject: "LE CLHUB — mail de test",
    react: TestEmail({ recipientName: recipientEmail.split("@")[0] ?? "" }),
  });

  if (error) {
    return { ok: false as const, message: error.message };
  }
  return { ok: true as const, id: data?.id };
}

export type TestEmailFormState =
  | { status: "idle" }
  | { status: "success"; id?: string }
  | { status: "error"; message: string };

export async function submitTestEmail(
  _prevState: TestEmailFormState,
  formData: FormData,
): Promise<TestEmailFormState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { status: "error", message: "Adresse mail invalide." };
  }

  try {
    const result = await sendTestEmail(email);
    return result.ok
      ? { status: "success", id: result.id }
      : { status: "error", message: result.message };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Erreur inconnue.",
    };
  }
}
