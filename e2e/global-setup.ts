import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const E2E_DB_URL = "postgresql://clhub:clhub@localhost:5432/clhub_e2e";
const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;

const E2E_DIR = path.resolve(__dirname);
const PID_FILE = path.join(E2E_DIR, ".server.pid");
export const LOG_FILE = path.join(E2E_DIR, ".server.log");

/**
 * Every table this app writes to, in dependency order (children first) —
 * truncating rather than dropping/recreating keeps schema migrations out
 * of the hot path for every test run. Mirrors the FK graph documented in
 * modules/admin/data/members.ts's deleteMemberCascade.
 */
const TABLES_IN_DELETE_ORDER = [
  "settlement_payment",
  "expense",
  "event_participant",
  "expense_event",
  "recipe_review",
  "recipe",
  "menu_response",
  "menu_event",
  "member_achievement",
  "action_token",
  "project",
  "wanted_interest",
  "wanted_post",
  "waitlist_entry",
  "item_comment",
  "maintenance_log",
  "item_photo",
  "booking",
  "item_unit",
  "item",
  "notification",
  "activity",
  "invitation",
  "session",
  "account",
  "verification",
  "member",
  "user",
];

async function resetDatabase(): Promise<void> {
  const client = new Client({ connectionString: E2E_DB_URL });
  await client.connect();
  // RESTART IDENTITY, not just DELETE: member.memberNumber is a Postgres
  // identity sequence, which a plain DELETE never rewinds — tests asserting
  // "membre #1" would silently start failing on the second run onward.
  // CASCADE takes care of any table outside this list with an FK into one
  // of these (e.g. achievement's catalog rows are seed data, deliberately
  // not in this list, but member_achievement pointing at a wiped member
  // still needs to go).
  const quoted = TABLES_IN_DELETE_ORDER.map((t) => `"${t}"`).join(", ");
  await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  await client.end();
}

function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() > deadline) reject(new Error(`Server at ${url} never became ready`));
          else setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

export default async function globalSetup(): Promise<void> {
  await resetDatabase();

  mkdirSync(E2E_DIR, { recursive: true });
  const logFd = openSync(LOG_FILE, "w");

  const child: ChildProcess = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: E2E_DB_URL,
      BETTER_AUTH_SECRET: "e2e-only-not-a-real-secret",
      APP_URL: BASE_URL,
      PORT: String(PORT),
      // A separate build cache from whatever dev server might already be
      // running on the same machine — see next.config.ts.
      E2E_DIST_DIR: ".next-e2e",
      // Explicit empty string, not omitted — Next's own .env.local loading
      // fills in unset vars, but leaves an already-present (even empty) one
      // alone. Without this, the real Resend key in .env.local would apply
      // here and every test booking/invite would try to send a real email.
      RESEND_API_KEY: "",
    },
    stdio: ["ignore", logFd, logFd],
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
  });

  writeFileSync(PID_FILE, String(child.pid));

  await waitForServer(BASE_URL, 60_000);
}
