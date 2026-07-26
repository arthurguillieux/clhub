import { db } from "./client";
import { member } from "./schema";

async function main() {
  console.log("Seeding development data...");

  const [arthur] = await db
    .insert(member)
    .values({
      memberNumber: 1,
      email: "arthur@example.com",
      displayName: "Arthur",
    })
    .onConflictDoNothing()
    .returning();

  if (arthur) {
    await db.insert(member).values({
      memberNumber: 2,
      email: "kazya@example.com",
      displayName: "Kazya",
      invitedById: arthur.id,
    });
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
