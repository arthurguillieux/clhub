/**
 * Long-poll plumbing for the Killer. The game itself is in Postgres; this only
 * wakes up the requests (phones, TV, organizer) waiting for its next change.
 * Single Node process on the NAS, so an in-memory registry is enough — and if
 * it's lost on a restart, clients simply re-poll and get the current state.
 */
type Waker = () => void;

const holder = globalThis as typeof globalThis & { __clhubKillerWaiters?: Map<string, Set<Waker>> };
const waiters: Map<string, Set<Waker>> = (holder.__clhubKillerWaiters ??= new Map());

const MAX_WAITERS_PER_GAME = 80;

export function notifyGame(gameId: string): void {
  const set = waiters.get(gameId);
  if (!set) return;
  for (const wake of [...set]) wake();
}

/** Resolves on the game's next change, after `timeoutMs`, or when the client goes away. */
export function waitForChange(gameId: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  const set = waiters.get(gameId) ?? new Set<Waker>();
  waiters.set(gameId, set);
  if (set.size >= MAX_WAITERS_PER_GAME) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      set.delete(finish);
      if (set.size === 0) waiters.delete(gameId);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    signal?.addEventListener("abort", finish, { once: true });
    set.add(finish);
  });
}
