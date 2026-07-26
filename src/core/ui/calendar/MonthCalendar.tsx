"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  compare,
  diffDays,
  endOfMonth,
  formatFrench,
  startOfMonth,
  today,
  weekday,
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
  borrowerId?: string;
  /** Set only when the item has more than one active unit (ADR-004) — disambiguates overlapping ribbons. */
  unitLabel?: string;
}

function displayLabel(b: CalendarBooking): string {
  return b.unitLabel ? `${b.borrowerName} · ${b.unitLabel}` : b.borrowerName;
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

/** Same month, same day-of-month, clamped to the shorter month's last day. */
function shiftMonth(anchor: CalendarDate, monthDelta: 1 | -1): CalendarDate {
  const dayOfMonth = Number(anchor.slice(8, 10));
  const targetAnchor = monthDelta === 1 ? nextMonthAnchor(anchor) : prevMonthAnchor(anchor);
  const lastDayOfTarget = Number(endOfMonth(targetAnchor).slice(8, 10));
  const clampedDay = Math.min(dayOfMonth, lastDayOfTarget);
  return `${targetAnchor.slice(0, 8)}${String(clampedDay).padStart(2, "0")}` as CalendarDate;
}

function cornerRadius(seg: { isRangeStart: boolean; isRangeEnd: boolean }): string {
  if (seg.isRangeStart && seg.isRangeEnd) return "rounded-md";
  if (seg.isRangeStart) return "rounded-l-md";
  if (seg.isRangeEnd) return "rounded-r-md";
  return "";
}

function describeDay(day: CalendarDate, bookings: CalendarBooking[]): string {
  const base = formatFrench(day);
  const covering = bookings.find(
    (b) =>
      compare(day, b.startDate as CalendarDate) >= 0 && compare(day, b.endDate as CalendarDate) <= 0,
  );
  if (!covering) return `${base}, disponible`;
  const statusLabel = covering.status === "pending" ? "demande en attente" : "réservé";
  return `${base}, ${statusLabel} — ${displayLabel(covering)}`;
}

export interface DragUpdate {
  bookingId: string;
  start: CalendarDate;
  end: CalendarDate;
}

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  bookingId: string;
  mode: DragMode;
  originalStart: CalendarDate;
  originalEnd: CalendarDate;
}

export function MonthCalendar({
  category,
  bookings,
  onSelectRange,
  currentMemberId,
  onUpdateRange,
}: {
  category: string;
  bookings: CalendarBooking[];
  onSelectRange?: (range: { start: CalendarDate; end: CalendarDate }) => void;
  /** When set, bookings belonging to this member (pending/approved) can be dragged to reschedule. */
  currentMemberId?: string;
  onUpdateRange?: (update: DragUpdate) => void;
}) {
  const [monthAnchor, setMonthAnchor] = useState<CalendarDate>(() => today());
  const [selStart, setSelStart] = useState<CalendarDate | null>(null);
  const [selEnd, setSelEnd] = useState<CalendarDate | null>(null);

  const weeks = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const todayDate = useMemo(() => today(), []);
  const currentMonthNumber = startOfMonth(monthAnchor).slice(0, 7); // "YYYY-MM"
  const allVisibleDays = useMemo(() => weeks.flatMap((w) => w.days), [weeks]);

  const [focusedDay, setFocusedDay] = useState<CalendarDate>(() =>
    weeks.flatMap((w) => w.days).includes(todayDate) ? todayDate : startOfMonth(monthAnchor),
  );
  const dayButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocusDay = useRef<CalendarDate | null>(null);

  useEffect(() => {
    if (!pendingFocusDay.current) return;
    const target = pendingFocusDay.current;
    if (allVisibleDays.includes(target)) {
      dayButtonRefs.current.get(target)?.focus();
      pendingFocusDay.current = null;
    }
  }, [allVisibleDays]);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverDay, setDragOverDay] = useState<CalendarDate | null>(null);

  const weekSegments = useMemo(() => {
    type Seg = PlaceableSegment & { status: string; label: string; isMine: boolean };
    const perWeek: Seg[][] = weeks.map(() => []);
    for (const b of bookings) {
      const isMine =
        !!currentMemberId &&
        b.borrowerId === currentMemberId &&
        (b.status === "pending" || b.status === "approved") &&
        !!onUpdateRange;
      const segs = sliceByWeek(
        { start: b.startDate as CalendarDate, end: b.endDate as CalendarDate },
        weeks,
      );
      for (const seg of segs) {
        perWeek[seg.weekIndex]?.push({ ...seg, id: b.id, status: b.status, label: displayLabel(b), isMine });
      }
    }
    return perWeek.map((segs) => packLanes(segs));
  }, [bookings, weeks, currentMemberId, onUpdateRange]);

  const catBg = CATEGORY_BG[category] ?? "bg-cat-autre";

  function handleSegmentDragStart(
    event: React.DragEvent<HTMLDivElement>,
    bookingId: string,
    mode: DragMode,
  ) {
    const source = bookings.find((b) => b.id === bookingId);
    if (!source) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookingId);
    setDragState({
      bookingId,
      mode,
      originalStart: source.startDate as CalendarDate,
      originalEnd: source.endDate as CalendarDate,
    });
  }

  function handleDayDrop(day: CalendarDate) {
    setDragOverDay(null);
    if (!dragState || !onUpdateRange) return;
    const { bookingId, mode, originalStart, originalEnd } = dragState;
    setDragState(null);

    let newStart = originalStart;
    let newEnd = originalEnd;
    if (mode === "move") {
      const duration = diffDays(originalStart, originalEnd);
      newStart = day;
      newEnd = addDays(day, duration);
    } else if (mode === "resize-start") {
      if (compare(day, originalEnd) > 0) return;
      newStart = day;
    } else {
      if (compare(day, originalStart) < 0) return;
      newEnd = day;
    }
    if (newStart === originalStart && newEnd === originalEnd) return;
    onUpdateRange({ bookingId, start: newStart, end: newEnd });
  }

  function handleDayClick(day: CalendarDate) {
    setFocusedDay(day);
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

  /** Moves the roving-tabindex focus to `target`, paginating the month if it falls outside the visible grid. */
  function moveFocusTo(target: CalendarDate) {
    setFocusedDay(target);
    if (allVisibleDays.includes(target)) {
      dayButtonRefs.current.get(target)?.focus();
      return;
    }
    pendingFocusDay.current = target;
    setMonthAnchor(compare(target, monthAnchor) < 0 ? prevMonthAnchor(monthAnchor) : nextMonthAnchor(monthAnchor));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, day: CalendarDate) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocusTo(addDays(day, -1));
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocusTo(addDays(day, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocusTo(addDays(day, -7));
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocusTo(addDays(day, 7));
        break;
      case "Home":
        event.preventDefault();
        moveFocusTo(addDays(day, -(weekday(day) - 1)));
        break;
      case "End":
        event.preventDefault();
        moveFocusTo(addDays(day, 7 - weekday(day)));
        break;
      case "PageUp":
        event.preventDefault();
        moveFocusTo(shiftMonth(day, -1));
        break;
      case "PageDown":
        event.preventDefault();
        moveFocusTo(shiftMonth(day, 1));
        break;
    }
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

      <div
        role="grid"
        aria-label={`Calendrier — ${monthLabel(monthAnchor)}`}
        className="flex flex-col gap-0.5"
      >
        {weeks.map((week, weekIndex) => {
          const segs = weekSegments[weekIndex] ?? [];
          const laneCount = Math.max(1, ...segs.map((s) => s.lane + 1));
          return (
            <div
              key={week.start}
              role="row"
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
                    ref={(el) => {
                      if (el) dayButtonRefs.current.set(day, el);
                      else dayButtonRefs.current.delete(day);
                    }}
                    type="button"
                    role="gridcell"
                    aria-selected={selected}
                    aria-label={describeDay(day, bookings)}
                    tabIndex={day === focusedDay ? 0 : -1}
                    disabled={!onSelectRange}
                    onClick={() => handleDayClick(day)}
                    onFocus={() => setFocusedDay(day)}
                    onKeyDown={(e) => handleKeyDown(e, day)}
                    onDragOver={(e) => {
                      if (!dragState) return;
                      e.preventDefault();
                    }}
                    onDragEnter={() => dragState && setDragOverDay(day)}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDayDrop(day);
                    }}
                    style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                    className={[
                      "flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-xs",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      inMonth ? "text-ink" : "text-muted/40",
                      isToday ? "font-bold ring-1 ring-primary" : "",
                      day === dragOverDay ? "ring-2 ring-accent" : "",
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
                  aria-hidden="true"
                  draggable={seg.isMine}
                  onDragStart={(e) => handleSegmentDragStart(e, seg.id, "move")}
                  onDragEnd={() => {
                    setDragState(null);
                    setDragOverDay(null);
                  }}
                  style={{ gridColumn: `${seg.startCol + 1} / span ${seg.span}`, gridRow: seg.lane + 2 }}
                  className={[
                    "relative flex items-center overflow-hidden px-1.5 text-[10.5px] font-medium whitespace-nowrap",
                    cornerRadius(seg),
                    seg.status === "pending"
                      ? "border border-dashed border-ink/30 bg-ink/10 text-ink"
                      : `${catBg} text-white`,
                    seg.isMine ? "cursor-grab active:cursor-grabbing" : "",
                  ].join(" ")}
                  title={seg.isMine ? `${seg.label} — glisser pour déplacer` : seg.label}
                >
                  {seg.isMine && seg.isRangeStart && (
                    <div
                      draggable
                      onDragStart={(e) => handleSegmentDragStart(e, seg.id, "resize-start")}
                      onDragEnd={() => {
                        setDragState(null);
                        setDragOverDay(null);
                      }}
                      className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                      title="Étirer le début"
                    />
                  )}
                  {seg.label}
                  {seg.isMine && seg.isRangeEnd && (
                    <div
                      draggable
                      onDragStart={(e) => handleSegmentDragStart(e, seg.id, "resize-end")}
                      onDragEnd={() => {
                        setDragState(null);
                        setDragOverDay(null);
                      }}
                      className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                      title="Étirer la fin"
                    />
                  )}
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
