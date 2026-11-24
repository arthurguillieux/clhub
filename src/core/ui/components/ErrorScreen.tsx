"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Container } from "./Container";
import { Button, LinkButton } from "./Button";

/**
 * What a member sees when a page breaks, instead of Next's bare English screen: what happened in
 * plain words, « Réessayer », and a direct way to tell the admins (the page is prefilled).
 */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container size="sm">
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="font-display text-6xl font-extrabold text-primary glow-text-primary">Oups</p>
        <h1 className="font-display text-xl font-extrabold text-balance text-ink">Cette page a eu un raté.</h1>
        <p className="max-w-sm text-sm text-muted">
          Rien n&apos;est perdu : ce que tu avais déjà enregistré est toujours là. Réessaie ; si ça recommence, dis-le aux admins.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            Réessayer
          </Button>
          <LinkButton href={`/signaler?page=${encodeURIComponent(pathname)}`} variant="ghost">
            Signaler un bug
          </LinkButton>
        </div>
        <Link href="/" className="py-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          Retour à l&apos;accueil
        </Link>
        {error.digest && <p className="font-mono text-xs text-muted">Référence : {error.digest}</p>}
      </div>
    </Container>
  );
}
