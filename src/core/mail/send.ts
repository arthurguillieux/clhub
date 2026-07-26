import type { ReactElement } from "react";
import { getMailClient, requireMailFrom } from "./client";

/**
 * Without RESEND_API_KEY, dev mode logs instead of throwing — lets the whole
 * auth/invitation flow be exercised locally before anyone sets up Resend.
 * Production has no such fallback: a misconfigured deployment should fail loudly.
 */
export async function sendMail({
  to,
  subject,
  react,
  devFallbackMessage,
}: {
  to: string;
  subject: string;
  react: ReactElement;
  devFallbackMessage: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required environment variable: RESEND_API_KEY");
    }
    console.log(`[dev mail] ${devFallbackMessage}`);
    return;
  }

  const { error } = await getMailClient().emails.send({
    from: requireMailFrom(),
    to,
    subject,
    react,
  });
  if (error) {
    throw new Error(`Failed to send mail: ${error.message}`);
  }
}
