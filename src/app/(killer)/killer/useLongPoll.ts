"use client";

import { useEffect, useRef, useState } from "react";

type PollState<T> = { data: T | null; gone: boolean; lost: boolean };

/**
 * Long-polls `path` (the server holds each request until the game changes),
 * reconnecting by itself after a sleeping phone, an app switch or a network
 * blip. `gone` = 404 (game deleted); `lost` = 410 (this phone's seat was
 * released). Same approach as the Buzzer, which proxies don't break.
 */
export function useLongPoll<T extends { version: number }>(path: string | null, initial: T | null = null): PollState<T> {
  const [state, setState] = useState<PollState<T>>({ data: initial, gone: false, lost: false });
  const [restartCount, setRestartCount] = useState(0);
  const lastAnswerAt = useRef(0);
  const versionRef = useRef(initial?.version ?? -1);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    let controller: AbortController | null = null;
    lastAnswerAt.current = Date.now();

    (async () => {
      while (alive) {
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), 30_000);
        try {
          const sep = path.includes("?") ? "&" : "?";
          const response = await fetch(`${path}${sep}v=${versionRef.current}`, { cache: "no-store", signal: controller.signal });
          if (!alive) return;
          if (response.status === 404) return setState((s) => ({ ...s, gone: true }));
          if (response.status === 410) return setState((s) => ({ ...s, lost: true }));
          if (!response.ok) throw new Error(String(response.status));
          const next = (await response.json()) as T;
          if (!alive) return;
          lastAnswerAt.current = Date.now();
          versionRef.current = next.version;
          setState({ data: next, gone: false, lost: false });
        } catch {
          if (alive) await new Promise((resolve) => setTimeout(resolve, 1500));
        } finally {
          clearTimeout(timeout);
        }
      }
    })();

    return () => {
      alive = false;
      controller?.abort();
    };
  }, [path, restartCount]);

  useEffect(() => {
    const restart = () => setRestartCount((n) => n + 1);
    const watchdog = setInterval(() => {
      if (lastAnswerAt.current && Date.now() - lastAnswerAt.current > 35_000) restart();
    }, 5000);
    const onVisible = () => {
      if (!document.hidden) restart();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", restart);
    return () => {
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", restart);
    };
  }, []);

  return state;
}
