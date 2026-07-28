import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { PointCounter } from "./PointCounter";

export default function JeuxPage() {
  return (
    <Container size="md">
      <PageTitle>Jeux</PageTitle>
      <div className="mt-8">
        <PointCounter />
      </div>
    </Container>
  );
}
