import { randomUUID } from "node:crypto";
import { Client } from "pg";

const E2E_DB_URL = "postgresql://clhub:clhub@localhost:5432/clhub_e2e";

/**
 * Seeds a second participant directly in the database — for tests whose
 * focus is an in-app flow (e.g. caisse's split math), not auth mechanics,
 * going through the full invite-and-magic-link dance for every fixture
 * member would only slow the suite down without testing anything new.
 */
export async function createTestMember(name: string, email: string): Promise<{ memberId: string }> {
  const client = new Client({ connectionString: E2E_DB_URL });
  await client.connect();
  try {
    const userId = randomUUID();
    await client.query('INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, $2, $3, true)', [
      userId,
      name,
      email,
    ]);
    const result = await client.query('INSERT INTO member (user_id) VALUES ($1) RETURNING id', [userId]);
    return { memberId: result.rows[0].id as string };
  } finally {
    await client.end();
  }
}
