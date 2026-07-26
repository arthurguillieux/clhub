import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listItems } from "@/modules/pretotheque/data/items";
import { listBookingsForPlanning } from "@/modules/pretotheque/data/bookings";
import { addDays, eachDay, formatFrench, parse, today, weekday, type CalendarDate } from "@/core/date";
import { clipToRange, packLanes, type PlaceableSegment } from "@/core/ui/calendar/layout";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { CATEGORY_BG } from "@/core/ui/categories";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const WINDOW_DAYS = 21;
const NAME_COL_WIDTH = "160px";
const LANE_HEIGHT = 24;

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { start } = await searchParams;
  const windowStart = start ? parse(start) : today();
  const windowEnd = addDays(windowStart, WINDOW_DAYS - 1);
  const days = eachDay(windowStart, windowEnd);
  const todayDate = today();

  const [items, bookings] = await Promise.all([
    listItems(),
    listBookingsForPlanning(windowStart, windowEnd),
  ]);

  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const bookingsByItem = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const list = bookingsByItem.get(b.itemId) ?? [];
    list.push(b);
    bookingsByItem.set(b.itemId, list);
  }

  // Precompute each item's lane-packed segments and its starting grid row —
  // row heights vary with lane count, so each row's start depends on every
  // row before it. Row 1 is the day header.
  const itemRows = sortedItems.reduce<
    {
      item: (typeof sortedItems)[number];
      placed: (PlaceableSegment & { status: string; label: string; lane: number })[];
      laneCount: number;
      rowStart: number;
    }[]
  >((rows, it) => {
    const segments = (bookingsByItem.get(it.id) ?? [])
      .map((b) => {
        const seg = clipToRange(
          { start: b.startDate as CalendarDate, end: b.endDate as CalendarDate },
          { start: windowStart, end: windowEnd },
        );
        return seg ? { ...seg, id: b.id, status: b.status, label: b.borrowerName } : null;
      })
      .filter((s): s is PlaceableSegment & { status: string; label: string } => s !== null);

    const placed = packLanes(segments);
    const laneCount = Math.max(1, ...placed.map((s) => s.lane + 1));
    const previous = rows[rows.length - 1];
    const rowStart = previous ? previous.rowStart + previous.laneCount : 2;
    rows.push({ item: it, placed, laneCount, rowStart });
    return rows;
  }, []);

  return (
    <Container size="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Planning</PageTitle>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/pretotheque/planning?start=${addDays(windowStart, -WINDOW_DAYS)}`}
            className="rounded-md px-2 py-1 text-muted hover:bg-surface"
          >
            ← Précédent
          </Link>
          <span className="text-ink">
            {formatFrench(windowStart)} — {formatFrench(windowEnd)}
          </span>
          <Link
            href={`/pretotheque/planning?start=${addDays(windowStart, WINDOW_DAYS)}`}
            className="rounded-md px-2 py-1 text-muted hover:bg-surface"
          >
            Suivant →
          </Link>
        </div>
      </div>

      {sortedItems.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Aucun objet dans la prêtothèque pour l&apos;instant.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <div
            className="grid gap-y-1 text-xs"
            style={{ gridTemplateColumns: `${NAME_COL_WIDTH} repeat(${WINDOW_DAYS}, minmax(30px, 1fr))` }}
          >
            <div />
            {days.map((day, i) => {
              const isToday = day === todayDate;
              return (
                <div
                  key={day}
                  style={{ gridColumn: i + 2, gridRow: 1 }}
                  className={`flex flex-col items-center pb-1 ${isToday ? "font-bold text-primary" : "text-muted"}`}
                >
                  <span className="uppercase">{WEEKDAY_LABELS[weekday(day) - 1]}</span>
                  <span>{Number(day.slice(8, 10))}</span>
                </div>
              );
            })}

            {itemRows.map(({ item: it, placed, laneCount, rowStart }) => {
              return (
                <div key={it.id} style={{ display: "contents" }}>
                  <div
                    style={{ gridColumn: 1, gridRow: `${rowStart} / span ${laneCount}` }}
                    className="flex items-center truncate pr-2 text-ink"
                    title={it.name}
                  >
                    <Link href={`/pretotheque/${it.slug}`} className="truncate hover:underline">
                      {it.name}
                    </Link>
                  </div>
                  <div
                    style={{
                      gridColumn: `2 / span ${WINDOW_DAYS}`,
                      gridRow: `${rowStart} / span ${laneCount}`,
                      display: "grid",
                      gridTemplateColumns: `repeat(${WINDOW_DAYS}, minmax(30px, 1fr))`,
                      gridTemplateRows: `repeat(${laneCount}, ${LANE_HEIGHT}px)`,
                    }}
                    className="border-b border-line-soft"
                  >
                    {placed.map((seg) => (
                      <div
                        key={seg.id}
                        style={{ gridColumn: `${seg.startCol + 1} / span ${seg.span}`, gridRow: seg.lane + 1 }}
                        className={[
                          "flex items-center overflow-hidden px-1.5 text-[10.5px] font-medium whitespace-nowrap",
                          seg.isRangeStart ? "rounded-l-md" : "",
                          seg.isRangeEnd ? "rounded-r-md" : "",
                          seg.status === "pending"
                            ? "border border-dashed border-ink/30 bg-ink/10 text-ink"
                            : `${CATEGORY_BG[it.category] ?? "bg-cat-autre"} text-white`,
                        ].join(" ")}
                        title={seg.label}
                      >
                        {seg.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Container>
  );
}
