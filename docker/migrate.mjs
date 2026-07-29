// Runs at container boot, before server.js (see Dockerfile CMD) — applies
// any pending Drizzle migrations against DATABASE_URL. Uses drizzle-orm's
// own migrator rather than the drizzle-kit CLI: drizzle-kit is a
// devDependency (not present in the production image), while drizzle-orm
// and pg already are, since the app itself needs them at runtime.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log("[migrate] applying pending migrations...");
  await migrate(db, { migrationsFolder: path.join(__dirname, "drizzle") });
  console.log("[migrate] up to date.");

  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
