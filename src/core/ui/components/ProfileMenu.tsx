"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/core/auth/client";

interface HeaderUser {
  name: string;
  image?: string | null;
}

export function ProfileMenu({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-full border border-line-soft py-1 pr-3 pl-1 text-sm text-ink transition-colors hover:border-primary/50 hover:bg-surface-raised"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- small avatar thumbnail
          <img src={user.image} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[130px] truncate sm:inline">{user.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-48 rounded-md border border-line bg-surface-raised p-1.5 shadow-lg">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface"
          >
            Réglages
          </Link>
          <Link
            href="/pretotheque/mine"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface"
          >
            Mon activité
          </Link>
          <Link
            href="/invite"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface"
          >
            Inviter
          </Link>
          <hr className="my-1.5 border-line-soft" />
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-surface dark:text-red-400"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
