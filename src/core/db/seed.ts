import { randomUUID } from "node:crypto";
import { db } from "./client";
import { member, user } from "./schema";

async function seedMember(email: string, name: string, invitedById: string | null) {
  const [createdUser] = await db
    .insert(user)
    .values({ id: randomUUID(), email, name, emailVerified: true })
    .onConflictDoNothing({ target: user.email })
    .returning();

  if (!createdUser) return null; // already seeded

  const [createdMember] = await db
    .insert(member)
    .values({ userId: createdUser.id, invitedById })
    .returning();

  return createdMember ?? null;
}

async function main() {
  console.log("Seeding development data...");

  const arthur = await seedMember("arthur@example.com", "Arthur", null);
  if (arthur) {
    await seedMember("kazya@example.com", "Kazya", arthur.id);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
