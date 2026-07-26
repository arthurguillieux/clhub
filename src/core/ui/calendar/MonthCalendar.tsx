"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  compare,
  endOfMonth,
  startOfMonth,
  today,
  type CalendarDate,
} from "@/core/date";
import { buildMonthGrid, packLanes, sliceByWeek, type PlaceableSegment } from "./layout";
import { CATEGORY_BG } from "@/core/ui/categories";

export interface CalendarBooking {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  borrowerName: string;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const RIBBON_HEIGHT = 22;

/** Avoids `Date` entirely, per ADR-005 — this is presentation, not arithmetic, but consistency costs nothing here. */
function monthLabel(anchor: CalendarDate): string {
  const [year, month] = anchor.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`;
}

function nextMonthAnchor(current: CalendarDate): CalendarDate {
  return addDays(endOfMonth(current), 1);
}
function prevMonthAnchor(current: CalendarDate): CalendarDate {
  return addDays(startOfMonth(current), -1);
}

function cornerRadius(seg: { isRangeStart: boolean; isRangeEnd: boolean }): string {
  if (seg.isRangeStart && seg.isRangeEnd) return "rounded-md";
  if (seg.isRangeStart) return "rounded-l-md";
  if (seg.isRangeEnd) return "rounded-r-md";
  return "";
}

export function MonthCalendar({
  category,
  bookings,
  onSelectRange,
}: {
  category: string;
  bookings: CalendarBooking[];
  onSelectRange?: (range: { start: CalendarDate; end: CalendarDate }) => void;
}) {
  const [monthAnchor, setMonthAnchor] = useState<CalendarDate>(() => today());
  const [selStart, setSelStart] = useState<CalendarDate | null>(null);
  const [selEnd, setSelEnd] = useState<CalendarDate | null>(null);

  const weeks = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const todayDate = useMemo(() => today(), []);
  const currentMonthNumber = startOfMonth(monthAnchor).slice(0, 7); // "YYYY-MM"

  const weekSegments = useMemo(() => {
    const perWeek: (PlaceableSegment & { status: string; label: string })[][] = weeks.map(
      () => [],
    );
    for (const b of bookings) {
      const segs = sliceByWeek(
        { start: b.startDate as CalendarDate, end: b.endDate as CalendarDate },
        weeks,
      );
      for (const seg of segs) {
        perWeek[seg.weekIndex]?.push({ ...seg, id: b.id, status: b.status, label: b.borrowerName });
      }
    }
    return perWeek.map((segs) => packLanes(segs));
  }, [bookings, weeks]);

  const catBg = CATEGORY_BG[category] ?? "bg-cat-autre";

  function handleDayClick(day: CalendarDate) {
    if (!onSelectRange) return;
    if (!selStart || selEnd) {
      setSelStart(day);
      setSelEnd(null);
      return;
    }
    const [s, e] = compare(day, selStart) < 0 ? [day, selStart] : [selStart, day];
    setSelStart(s);
    setSelEnd(e);
    onSelectRange({ start: s, end: e });
  }

  function isSelected(day: CalendarDate): boolean {
    if (!selStart) return false;
    const end = selEnd ?? selStart;
    return compare(day, selStart) >= 0 && compare(day, end) <= 0;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthAnchor(prevMonthAnchor(monthAnchor))}
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface"
          aria-label="Mois précédent"
        >
          ←
        </button>
        <span className="font-display text-base font-extrabold text-ink capitalize">
          {monthLabel(monthAnchor)}
        </span>
        <button
          type="button"
          onClick={() => setMonthAnchor(nextMonthAnchor(monthAnchor))}
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface"
          aria-label="Mois suivant"
        >
          →
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[11px] tracking-wide text-muted uppercase">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        {weeks.map((week, weekIndex) => {
          const segs = weekSegments[weekIndex] ?? [];
          const laneCount = Math.max(1, ...segs.map((s) => s.lane + 1));
          return (
            <div
              key={week.start}
              className="grid grid-cols-7 gap-x-0.5"
              style={{ gridTemplateRows: `28px repeat(${laneCount}, ${RIBBON_HEIGHT}px)` }}
            >
              {week.days.map((day, dayIndex) => {
                const inMonth = day.slice(0, 7) === currentMonthNumber;
                const isToday = day === todayDate;
                const selected = isSelected(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!onSelectRange}
                    onClick={() => handleDayClick(day)}
                    style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                    className={[
                      "flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-xs",
                      inMonth ? "text-ink" : "text-muted/40",
                      isToday ? "font-bold ring-1 ring-primary" : "",
                      selected ? "bg-accent text-accent-ink" : onSelectRange ? "hover:bg-surface" : "",
                    ].join(" ")}
                  >
                    {Number(day.slice(8, 10))}
                  </button>
                );
              })}

              {segs.map((seg) => (
                <div
                  key={`${seg.id}-${seg.weekIndex}`}
                  style={{ gridColumn: `${seg.startCol + 1} / span ${seg.span}`, gridRow: seg.lane + 2 }}
                  className={[
                    "flex items-center overflow-hidden px-1.5 text-[10.5px] font-medium whitespace-nowrap",
                    cornerRadius(seg),
                    seg.status === "pending"
                      ? "border border-dashed border-ink/30 bg-ink/10 text-ink"
                      : `${catBg} text-white`,
                  ].join(" ")}
                  title={seg.label}
                >
                  {seg.label}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${catBg}`} /> Confirmé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-ink/30 bg-ink/10" /> En
          attente
        </span>
      </div>
    </div>
  );
}
