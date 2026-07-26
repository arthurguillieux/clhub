import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let instance: Db | null = null;

function getDb(): Db {
  if (!instance) {
    const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
    instance = drizzle(pool, { schema });
  }
  return instance;
}

/**
 * A `Pool` connecting eagerly at module load would crash `next build`: Next
 * statically imports route modules to collect page data, with no runtime env
 * vars available yet. The proxy defers connection to first actual query.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop);
    // Bind methods to the real instance — a bare Reflect.get with this
    // proxy as receiver would hand Drizzle's internals a `this` that isn't
    // the actual db, breaking anything that reads `this` internally.
    return typeof value === "function" ? value.bind(real) : value;
  },
});
