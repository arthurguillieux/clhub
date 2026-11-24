"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const FLASH_COOKIE = "clhub_flash";
const EVENT = "clhub:toast";

/** Show a confirmation from anywhere on the client: `toast("Lien copié")`. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

/**
 * The one place confirmations appear, the same way everywhere: a small pill at the bottom of the
 * screen (above the phone's bar), read out by screen readers, gone after a few seconds. It picks up
 * what server actions left with `flash()` before redirecting, and what client code sends with `toast()`.
 */
export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const search = useSearchParams();

  const show = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 4500);
  }, []);

  // A flash left by the server for this page (read on the next tick, so the page has settled).
  useEffect(() => {
    const t = setTimeout(() => {
      const raw = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
      if (!raw) return;
      document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0`;
      try {
        show(decodeURIComponent(decodeURIComponent(raw.slice(FLASH_COOKIE.length + 1))));
      } catch {
        /* a mangled cookie: nothing to show */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [pathname, search, show]);

  useEffect(() => {
    const onToast = (e: Event) => show(String((e as CustomEvent).detail));
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, [show]);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 md:bottom-8 print:hidden">
      {message && (
        <p className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-ground shadow-lg motion-safe:animate-[toast-in_180ms_ease-out]">
          <span aria-hidden="true">✓</span>
          {message}
        </p>
      )}
    </div>
  );
}
