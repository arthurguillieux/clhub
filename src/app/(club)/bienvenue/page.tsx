import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { LinkButton } from "@/core/ui/components/Button";

export default function BienvenuePage() {
  return (
    <Container size="sm">
      <PageTitle>Bienvenue au CLHUB</PageTitle>
      <Card className="mt-6 flex flex-col gap-4 p-5">
        <p className="text-sm text-ink">
          Le CLHUB, c&apos;est l&apos;endroit où on partage nos affaires (la prêtothèque), on
          s&apos;organise pour bouffer ensemble, on suit la caisse commune, on se pique des
          recettes, et on se lance des dés quand on n&apos;a rien de mieux à faire.
        </p>
        <p className="text-sm text-muted">
          Un bug, une idée, un truc qui te chiffonne ? C&apos;est{" "}
          <strong className="text-ink">Vak</strong>{" "}
          qui pilote le projet avec vous, en direct — les retours et les bugs vont à lui, pas
          à l&apos;équipe technique.
        </p>
        <LinkButton href="/" variant="primary" className="self-start">
          C&apos;est parti
        </LinkButton>
      </Card>
    </Container>
  );
}
