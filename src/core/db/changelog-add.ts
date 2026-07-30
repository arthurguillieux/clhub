import { db } from "./client";
import { changelogEntry } from "./schema";

/**
 * CLI-only — there's no member-facing form for this table, Claude adds
 * entries here across dev sessions. Usage:
 *   pnpm changelog:add "Résumé d'une nouveauté" "Un autre résumé, même jour"
 *   pnpm changelog:add --date 2026-07-28 "Résumé pour un autre jour"
 */
async function main() {
  const args = process.argv.slice(2);
  let entryDate = new Date().toISOString().slice(0, 10);
  const summaries: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date") {
      const value = args[++i];
      if (!value) throw new Error("--date needs a YYYY-MM-DD value");
      entryDate = value;
    } else {
      summaries.push(args[i] as string);
    }
  }

  if (summaries.length === 0) {
    console.error('Usage: pnpm changelog:add "Résumé" ["Autre résumé"...] [--date YYYY-MM-DD]');
    process.exit(1);
  }

  for (const summary of summaries) {
    await db.insert(changelogEntry).values({ entryDate, summary });
    console.log(`Added [${entryDate}] ${summary}`);
  }
}

main().then(() => process.exit(0));
