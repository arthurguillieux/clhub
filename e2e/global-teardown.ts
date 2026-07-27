import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const PID_FILE = path.join(__dirname, ".server.pid");

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(PID_FILE)) return;
  const pid = Number(readFileSync(PID_FILE, "utf-8").trim());
  rmSync(PID_FILE);
  if (!Number.isFinite(pid)) return;

  try {
    if (process.platform === "win32") {
      // /T kills the whole tree — the PID we stored is the shell wrapping
      // `next dev`, and Turbopack forks further from there.
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGKILL"); // negative PID: the whole detached process group
    }
  } catch {
    // Already gone — fine.
  }
}
