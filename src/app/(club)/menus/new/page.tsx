import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { computeSharedAvailability, summarizeByDay } from "@/modules/agenda/data/sharedAvailability";
import { addDays, eachDay, today } from "@/core/date";
import { NewMenuEventForm } from "./NewMenuEventForm";

const SUGGESTION_WINDOW_DAYS = 30;
const MAX_SUGGESTIONS = 8;

export default async function NewMenuEventPage() {
  const start = today();
  const end = addDays(start, SUGGESTION_WINDOW_DAYS);
  const availability = await computeSharedAvailability(start, end);
  const summaries = summarizeByDay(availability, eachDay(start, end));

  // countedTotal > 1: "tout le monde est libre" among zero or one connected
  // calendar isn't a signal worth suggesting.
  const suggestedDates = summaries
    .filter((s) => s.countedTotal > 1 && s.freeCount === s.countedTotal)
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.day);

  return (
    <Container>
      <PageTitle>Proposer un repas</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Les autres membres pourront dire s&apos;ils viennent et ce qu&apos;ils apportent.
      </p>

      <Card className="mt-6 p-5">
        <NewMenuEventForm suggestedDates={suggestedDates} />
      </Card>
    </Container>
  );
}
