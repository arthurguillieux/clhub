import { Container } from "@/core/ui/components/Container";
import { LinkButton } from "@/core/ui/components/Button";

export default function NotFound() {
  return (
    <Container size="sm">
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="font-display text-7xl font-extrabold text-primary glow-text-primary">404</p>
        <h1 className="font-display text-xl font-extrabold text-ink text-balance">
          Ce ne sont pas les octets que vous cherchez.
        </h1>
        <p className="max-w-sm text-sm text-muted">
          Cette page n&apos;existe pas, ou plus. Passez votre chemin.
        </p>
        <LinkButton href="/" variant="primary" className="mt-2">
          Retour à l&apos;accueil
        </LinkButton>
      </div>
    </Container>
  );
}
